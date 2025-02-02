import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { collection, query, where, collectionData, getDocs } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Auth, getAuth } from '@angular/fire/auth';

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

  async getCurrentUser() {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('No user logged in');
    }

    // Hole zusätzliche User-Daten aus Firestore
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('uid', '==', currentUser.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('User data not found in Firestore');
    }

    const userData = querySnapshot.docs[0].data();
    return {
      uid: currentUser.uid,
      username: userData['username'] || 'Unbekannter Benutzer',
      email: userData['email']
    };
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
    this.setIsDirectMessage(false);
  }

  selectUser(userName: string) {
    this.selectedUserSubject.next(userName);
    this.isDirectMessageSubject.next(true);
    this.currentChannelIdSubject.next('');
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
} 