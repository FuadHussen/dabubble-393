import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  Auth,
  signInWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import {  
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  writeBatch
} from '@angular/fire/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { Router } from '@angular/router';

interface UserData {
  uid: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline?: boolean;
}

interface FirestoreUser {
  uid: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  username?: string;
}

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

  // Neuer BehaviorSubject für den Avatar
  private avatarSubject = new BehaviorSubject<string | null>(null);
  avatar$ = this.avatarSubject.asObservable();

  // Add or update these methods
  private userDataSubject = new BehaviorSubject<any>(null);
  userData$ = this.userDataSubject.asObservable();

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
        // Update both username and avatar subjects
        if (userData['username']) {
          this.usernameSubject.next(userData['username']);
        }
        if (userData['avatar']) {
          this.avatarSubject.next(userData['avatar']);
        }
      } 
    } catch (error) {
      console.error('Fehler beim Laden der Benutzerdaten:', error);
    }
  }

  async login(email: string, password: string): Promise<any> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      // After login, fetch the most recent user data
      await this.refreshUserData(userCredential.user.uid);
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const auth = getAuth(); // Authentifizierungsinstanz holen

    try {
      // Sendet eine E-Mail zur Passwortzurücksetzung
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      // Fehlerbehandlung
      console.error('Fehler beim Senden der Passwort-Zurücksetzung:', error);
      throw new Error('Konnte die E-Mail nicht senden.');
    }
  }

  //change Avatar

  async saveAvatar(avatarPath: string, userId?: string): Promise<string> {
    try {
      const uid = userId || this.auth.currentUser?.uid;
      if (uid) {
        // Update in Firestore users collection
        const userDocRef = doc(this.firestore, 'users', uid);
        await updateDoc(userDocRef, { avatar: avatarPath });
        
        // Broadcast to update UI
        const currentData = this.userDataSubject.value || {};
        this.userDataSubject.next({
          ...currentData,
          uid,
          avatar: avatarPath
        });
      }
      return avatarPath;
    } catch (error) {
      console.error('Error saving avatar:', error);
      return '';
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
      const userDoc = await getDoc(doc(this.firestore, 'users', userId));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: userId,
          username: userData['username'] || 'Unbekannt',
          avatar: userData['avatar'],
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
  async updateUsername(username: string, userId?: string): Promise<void> {
    try {
      const uid = userId || this.auth.currentUser?.uid;
      if (uid) {
        // Update in Firestore users collection
        const userDocRef = doc(this.firestore, 'users', uid);
        await updateDoc(userDocRef, { username });
        
        // Broadcast to update UI
        const currentData = this.userDataSubject.value || {};
        this.userDataSubject.next({
          ...currentData,
          uid,
          username
        });
      }
    } catch (error) {
      console.error('Error updating username:', error);
    }
  }

  // Neue Methode zum Aktualisieren des Avatars
  updateAvatar(newAvatar: string | null) {
    this.avatarSubject.next(newAvatar);
    
    // Optional: Speichere den Avatar auch direkt in Firebase
    if (newAvatar && this.getCurrentUser()) {
      this.saveAvatar(newAvatar);
    }
  }

  async createUserIfNotExists(userId: string, userData: any): Promise<void> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', userId));

      if (!userDoc.exists()) {
        await setDoc(doc(this.firestore, 'users', userId), {
          uid: userId,
          username: 'Sofia Weber',  // oder userData.username
          email: 'sofia.weber@example.com',  // oder userData.email
          avatar: 'sofia-weber-avatar.png',
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }

  async searchUsers(searchTerm: string, excludeUserIds: string[] = []): Promise<UserData[]> {
    try {

      const usersRef = collection(this.firestore, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      const results = querySnapshot.docs
        .map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as UserData))  // Type assertion hinzugefügt
        .filter(user => {
          const usernameMatches = user.username?.toLowerCase().includes(searchTerm.toLowerCase());
          const isNotExcluded = !excludeUserIds.includes(user.uid);
          
          return usernameMatches && isNotExcluded;
        });

      return results;
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
        return uid;
      }
      return null;

    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<FirestoreUser[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as FirestoreUser[];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  // Add this new method to get fresh user data
  async refreshUserData(userId: string): Promise<any> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('uid', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        // Make sure userData has uid for reference
        userData['uid'] = userId;
        
        // Broadcast complete user data to all subscribers
        this.userDataSubject.next(userData);
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }

  async saveUserProfile(userId: string, profileData: {username?: string, avatar?: string}): Promise<boolean> {
    try {
      if (!userId) {
        console.error('Cannot save profile: No user ID provided');
        return false;
      }
      
      // Update in Firestore users collection
      const userDocRef = doc(this.firestore, 'users', userId);
      await updateDoc(userDocRef, profileData);
      
      // Also update all messages by this user - this is crucial!
      const messagesRef = collection(this.firestore, 'messages');
      const q = query(messagesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(this.firestore);
      querySnapshot.docs.forEach(docSnapshot => {
        const messageRef = doc(this.firestore, 'messages', docSnapshot.id);
        const updateData: any = {};
        
        if (profileData.username) {
          updateData.username = profileData.username;
        }
        if (profileData.avatar) {
          updateData.avatar = profileData.avatar;
        }
        
        if (Object.keys(updateData).length > 0) {
          batch.update(messageRef, updateData);
        }
      });
      
      await batch.commit();
      
      // Update local state
      const userData = {
        uid: userId,
        ...profileData
      };
      this.userDataSubject.next(userData);
      
      if (profileData.username) {
        this.usernameSubject.next(profileData.username);
      }
      if (profileData.avatar) {
        this.avatarSubject.next(profileData.avatar);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return false;
    }
  }
}
