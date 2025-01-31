import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Auth,
  signInWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { User as FirebaseUser } from 'firebase/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router);

  private currentUserSubject: BehaviorSubject<FirebaseUser | null> =
    new BehaviorSubject<FirebaseUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.loadUser();
  }

  // Lädt den aktuellen Benutzer
  loadUser(): void {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUserSubject.next(user);
        this.loadUserData(user.uid);
      }
    });
  }

  async loadUserData(userId: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
      } else {
        console.log('Benutzer existiert nicht in Firestore');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Benutzerdaten:', error);
    }
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const auth = getAuth(); // Authentifizierungsinstanz holen

    try {
      // Sendet eine E-Mail zur Passwortzurücksetzung
      await sendPasswordResetEmail(auth, email);
      console.log(`Passwort-Zurücksetzungs-E-Mail wurde an ${email} gesendet.`);
    } catch (error) {
      // Fehlerbehandlung
      console.error('Fehler beim Senden der Passwort-Zurücksetzung:', error);
      throw new Error('Konnte die E-Mail nicht senden.');
    }
  }

  //change Avatar

  async saveAvatar(avatarUrl: string): Promise<void> {
    const user = this.getCurrentUser();
    if (user) {
      const userRef = doc(this.firestore, 'users', user.uid);
      await setDoc(
        userRef,
        {
          avatar: avatarUrl,
        },
        { merge: true }
      );
      console.log('Avatar erfolgreich gespeichert!');
    }
  }

  //aktuellen Benutzer abzurufen
  getCurrentUser(): FirebaseUser | null {
    return this.currentUserSubject.value;
  }

  // Hilfsmethode, um sich abzumelden
  async logout(): Promise<void> {
    try {
      await getAuth().signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Fehler beim Abmelden:', error);
    }
  }
}
