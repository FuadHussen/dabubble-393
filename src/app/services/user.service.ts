import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Auth,
  signInWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  User,
} from '@angular/fire/auth';
import { DocumentData, Firestore, doc, getDoc, setDoc, collection, query, where, getDocs, DocumentData as FirestoreDocumentData } from '@angular/fire/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { Router } from '@angular/router';
import { User as UserModel } from '../models/user.model';  // Importiere das Interface

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

  // Neuer BehaviorSubject für den Username
  private usernameSubject = new BehaviorSubject<string>('');
  username$ = this.usernameSubject.asObservable();

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

  async getUserById(userId: string): Promise<any> {
    try {
      console.log('Getting user by ID:', userId);
      const userDoc = await getDoc(doc(this.firestore, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: userId,
          username: userData['username'] || 'Unbekannt',
          avatar: userData['avatar'] || 'default-avatar.png',
          email: userData['email'],
          isOnline: userData['isOnline'] || false
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  // Neue Methode zum Aktualisieren des Usernames
  updateUsername(newUsername: string) {
    this.usernameSubject.next(newUsername);
  }

  async createUserIfNotExists(userId: string, userData: any): Promise<void> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', userId));
      
      if (!userDoc.exists()) {
        console.log('Creating new user:', userId);
        await setDoc(doc(this.firestore, 'users', userId), {
          uid: userId,
          username: 'Sofia Weber',  // oder userData.username
          email: 'sofia.weber@example.com',  // oder userData.email
          avatar: 'sofia-weber-avatar.png',  // oder ein Default-Avatar
        });
        console.log('User created successfully');
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }

  async searchUsers(searchText: string, excludeUserIds: string[] = []): Promise<any[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        where('username', '>=', searchText),
        where('username', '<=', searchText + '\uf8ff')
      );
      
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({
          uid: doc.id,
          ...doc.data()
        }))
        // Filtere User aus, die bereits Mitglied sind
        .filter(user => !excludeUserIds.includes(user.uid));
      
      console.log('Search results:', users);
      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    try {
      const userString = localStorage.getItem('user');
      if (userString) {
        const user = JSON.parse(userString);
        const uid = user.uid || null;
        console.log('getCurrentUserId returning:', uid); // Debug log
        return uid;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }
}
