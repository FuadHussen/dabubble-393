import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { collection, query, where, collectionData, getDocs } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Auth, getAuth } from '@angular/fire/auth';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private currentChannelIdSubject = new BehaviorSubject<string>('');
  private isDirectMessageSubject = new BehaviorSubject<boolean>(false);
  private selectedUserSubject = new BehaviorSubject<string>('');
  private selectedChannelSubject = new BehaviorSubject<string>('');
  private hasMessagesSubject = new BehaviorSubject<boolean>(false);

  currentChannelId$ = this.currentChannelIdSubject.asObservable();
  isDirectMessage$ = this.isDirectMessageSubject.asObservable();
  selectedUser$ = this.selectedUserSubject.asObservable();
  selectedChannel$ = this.selectedChannelSubject.asObservable();
  hasMessages$ = this.hasMessagesSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  async getCurrentUser(): Promise<User> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.auth.onAuthStateChanged(user => {
        unsubscribe();
        if (user) {
          resolve({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            isOnline: true,  // Default Wert
            lastSeen: new Date(),  // Aktuelles Datum
            username: user.displayName || user.email  // Fallback zum Email
          } as User);
        } else {
          reject(new Error('No user logged in'));
        }
      }, reject);
    });
  }

  getCurrentChannelId() {
    return this.currentChannelId$;
  }

  setCurrentChannelId(channelId: string) {
    this.currentChannelIdSubject.next(channelId);
  }

  setIsDirectMessage(isDM: boolean) {
    this.isDirectMessageSubject.next(isDM);
  }

  setSelectedUser(user: string) {
    this.selectedUserSubject.next(user);
  }

  selectChannel(channelName: string) {
    this.selectedChannelSubject.next(channelName);
    this.selectedUserSubject.next('');
    this.isDirectMessageSubject.next(false);
  }


  selectUser(userId: string) {
    this.selectedUserSubject.next(userId);
    this.selectedChannelSubject.next('');
    this.isDirectMessageSubject.next(true);
  }


  selectNextAvailableChannel() {
    const channelsRef = collection(this.firestore, 'channels');
    collectionData(channelsRef, { idField: 'id' }).pipe(
      take(1)
    ).subscribe(channels => {
      if (channels.length > 0) {
        // Wähle den ersten verfügbaren Channel
        const nextChannel = channels[0] as any;  // Type assertion hinzufügen
        this.currentChannelIdSubject.next(nextChannel['name']);  // Bracket notation verwenden
      } else {
        // Falls keine Channels mehr existieren
        this.currentChannelIdSubject.next('');  // Leeren String statt null
      }
    });
  }

  getSelectedChannel() {
    return this.selectedChannel$;
  }

  setHasMessages(hasMessages: boolean) {
    this.hasMessagesSubject.next(hasMessages);
  }

  get selectedUser(): string {
    return this.selectedUserSubject.value;
  }

  get selectedChannel(): string {
    return this.selectedChannelSubject.value;
  }

  async getUserByDisplayName(displayName: string) {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('displayName', '==', displayName));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0];
      }
      console.error('No user found with displayName:', displayName);
      return null;
    } catch (error) {
      console.error('Error getting user by display name:', error);
      return null;
    }
  }

  async getUserId(displayNameOrId: string): Promise<string | null> {
    if (displayNameOrId.length > 20) {
      return displayNameOrId;
    }
    
    const userDoc = await this.getUserByDisplayName(displayNameOrId);
    return userDoc?.id || null;
  }

  createChatId(uid1: string, uid2: string): string {
    const chatId = [uid1, uid2].sort().join('_');
    return chatId;
  }

} 