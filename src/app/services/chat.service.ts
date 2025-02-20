import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { collection, query, where, collectionData, getDocs, addDoc, doc, getDoc, orderBy, serverTimestamp } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { User } from '../models/user.model';
import { AudioService } from './audio.service';
import { Message } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private currentChannelIdSubject = new BehaviorSubject<string>('');
  private isDirectMessageSubject = new BehaviorSubject<boolean>(false);
  private selectedUserSubject = new BehaviorSubject<string>('');
  private selectedChannelSubject = new BehaviorSubject<string>('');
  private hasMessagesSubject = new BehaviorSubject<boolean>(false);
  private isNewChatModeSubject = new BehaviorSubject<boolean>(false);
  private selectedUserDataSubject = new BehaviorSubject<any>(null);
  private threadMessageSubject = new BehaviorSubject<Message | null>(null);

  currentChannelId$ = this.currentChannelIdSubject.asObservable();
  isDirectMessage$ = this.isDirectMessageSubject.asObservable();
  selectedUser$ = this.selectedUserSubject.asObservable();
  selectedChannel$ = this.selectedChannelSubject.asObservable();
  hasMessages$ = this.hasMessagesSubject.asObservable();
  isNewChatMode$ = this.isNewChatModeSubject.asObservable();
  selectedUserData$ = this.selectedUserDataSubject.asObservable();
  threadMessage$ = this.threadMessageSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private audioService: AudioService
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

  setSelectedUser(user: string) {
    this.selectedUserSubject.next(user);
  }

  async selectUser(userId: string) {
    this.selectedUserSubject.next(userId);
    
    if (userId) {
      // Lade die User-Daten sofort
      const userDoc = await this.getUserData(userId);
      if (userDoc) {
        this.selectedUserDataSubject.next(userDoc);
      }
    }
  }

  private async getUserData(userId: string) {
    try {
      const userRef = doc(this.firestore, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return {
          id: userSnap.id,
          ...userSnap.data()
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }

  async selectNextAvailableChannel() {
    try {
      const currentUser = await this.auth.currentUser;
      if (!currentUser) return;

      // Zuerst versuchen wir einen anderen Channel zu finden
      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const memberQuery = query(
        channelMembersRef,
        where('userId', '==', currentUser.uid)
      );
      const memberSnapshot = await getDocs(memberQuery);
      const channelIds = memberSnapshot.docs.map(doc => doc.data()['channelId']);

      if (channelIds.length > 0) {
        // Hole den ersten verfügbaren Channel
        const channelsRef = collection(this.firestore, 'channels');
        const channelQuery = query(channelsRef, where('__name__', 'in', channelIds));
        const channelSnapshot = await getDocs(channelQuery);

        if (!channelSnapshot.empty) {
          const nextChannel = channelSnapshot.docs[0];
          const channelData = nextChannel.data();
          this.setCurrentChannelId(nextChannel.id);
          this.selectedChannelSubject.next(channelData['name']);
          this.setIsDirectMessage(false);
          return `/channel/${channelData['name']}/${nextChannel.id}`;
        }
      }

      // Wenn keine Channels verfügbar sind, versuche DMs zu finden
      const messagesRef = collection(this.firestore, 'messages');
      const dmQuery = query(
        messagesRef,
        where('recipientId', '==', currentUser.uid)
      );
      const dmSnapshot = await getDocs(dmQuery);

      if (!dmSnapshot.empty) {
        const firstDM = dmSnapshot.docs[0].data();
        const otherUserId = firstDM['userId'];
        this.setIsDirectMessage(true);
        this.selectUser(otherUserId);
        return `/dm/${otherUserId}`;
      }

      // Wenn weder Channels noch DMs verfügbar sind
      return '/workspace';

    } catch (error) {
      console.error('Error in selectNextAvailableChannel:', error);
      return '/workspace';
    }
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

  async createChannel(channelData: any) {
    try {
      const channelsRef = collection(this.firestore, 'channels');
      await addDoc(channelsRef, {
        ...channelData,
        createdAt: new Date(),  // Erstellungsdatum hinzufügen
      });
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  }

  setNewChatMode(value: boolean) {
    this.isNewChatModeSubject.next(value);
    if (value) {
      this.selectedChannelSubject.next('');
      this.selectedUserSubject.next('');
      this.selectedUserDataSubject.next(null);
      this.isDirectMessageSubject.next(false);
    }
  }

  async selectChannel(channelName: string) {
    this.selectedChannelSubject.next(channelName);
  }

  async setIsDirectMessage(isDM: boolean) {
    this.isDirectMessageSubject.next(isDM);
    if (!isDM) {
      // Reset user data when switching to channel
      this.selectedUserDataSubject.next(null);
    }
  }

  async sendMessage(messageData: any) {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      await addDoc(messagesRef, {
        ...messageData,
        timestamp: new Date()
      });
      
      // Sound abspielen nach erfolgreichem Senden
      this.audioService.playMessageSound();
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  async startDirectMessage(userId: string) {
    try {
      await this.setIsDirectMessage(true);
      await this.selectUser(userId);
      return true;
    } catch (error) {
      console.error('Error starting DM:', error);
      return false;
    }
  }

  setThreadMessage(message: Message | null) {
    this.threadMessageSubject.next(message);
  }

  async getThreadReplies(messageId: string): Promise<Message[]> {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const q = query(messagesRef, where('parentId', '==', messageId), orderBy('timestamp', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
    } catch (error) {
      console.error('Error getting thread replies:', error);
      return [];
    }
  }

  async sendThreadReply(threadMessage: Message, replyText: string) {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const currentUser = await this.getCurrentUser();
      
      if (!currentUser) throw new Error('No user logged in');

      const replyData = {
        text: replyText,
        userId: currentUser.uid,
        username: currentUser.username || currentUser.displayName || currentUser.email,
        timestamp: serverTimestamp(),
        parentId: threadMessage.id,
        channelId: threadMessage.channelId,
        avatar: currentUser.avatar || 'default-avatar.png',
        isThread: true
      };

      await addDoc(messagesRef, replyData);
      this.audioService.playMessageSound();
    } catch (error) {
      console.error('Error sending thread reply:', error);
      throw error;
    }
  }
}