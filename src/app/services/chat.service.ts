import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { collection, query, where, collectionData, getDocs, addDoc, doc, getDoc, orderBy, serverTimestamp, Query, DocumentData, limit } from '@angular/fire/firestore';
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
  private messageSubscription: any;  // Subscription speichern
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private refreshChannelsSubject = new BehaviorSubject<boolean>(false);
  private highlightMessageSubject = new BehaviorSubject<string>('');
  private scrollToMessageSubject = new BehaviorSubject<string>('');

  currentChannelId$ = this.currentChannelIdSubject.asObservable();
  isDirectMessage$ = this.isDirectMessageSubject.asObservable();
  selectedUser$ = this.selectedUserSubject.asObservable();
  selectedChannel$ = this.selectedChannelSubject.asObservable();
  hasMessages$ = this.hasMessagesSubject.asObservable();
  isNewChatMode$ = this.isNewChatModeSubject.asObservable();
  selectedUserData$ = this.selectedUserDataSubject.asObservable();
  threadMessage$ = this.threadMessageSubject.asObservable();
  messages$ = this.messagesSubject.asObservable();
  refreshChannels$ = this.refreshChannelsSubject.asObservable();
  highlightMessage$ = this.highlightMessageSubject.asObservable();
  scrollToMessage$ = this.scrollToMessageSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private audioService: AudioService
  ) { }

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

  // Neue Methode hinzufügen
  triggerChannelsRefresh() {
    this.refreshChannelsSubject.next(true);
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

  async selectNextAvailableChannel(): Promise<string> {
    try {
      const currentUserId = this.auth.currentUser?.uid;

      if (!currentUserId) {
        return '/workspace';
      }

      // 1. Zuerst nach verfügbaren Channels suchen
      const channelMembersRef = collection(this.firestore, 'channelMembers');

      // Alle Mitgliedschaften abrufen
      const channelQuery = query(
        channelMembersRef,
        where('userId', '==', currentUserId)
      );
      const channelMembersSnapshot = await getDocs(channelQuery);

      // Extrahiere alle Channel-IDs, in denen der Benutzer Mitglied ist
      const userChannelIds = channelMembersSnapshot.docs.map(doc => doc.data()['channelId']);

      if (userChannelIds.length > 0) {
        // Ähnlich wie in sidenav.component.ts, prüfe jeden Channel einzeln
        for (const channelId of userChannelIds) {
          const channelDocRef = doc(this.firestore, 'channels', channelId);
          const channelSnap = await getDoc(channelDocRef);

          if (channelSnap.exists()) {
            const channelData = channelSnap.data();

            // Setzen der Channel-Daten im Service
            this.setCurrentChannelId(channelId);
            this.selectedChannelSubject.next(channelData['name'] || '');
            this.setIsDirectMessage(false);

            const channelRoute = `/workspace/channel/${channelId}`;
            return channelRoute;
          }
        }
      } 

      // Nach DMs suchen
      try {
        const messagesRef = collection(this.firestore, 'messages');

        // Empfangene Nachrichten prüfen
        const receivedMessagesQuery = query(
          messagesRef,
          where('recipientId', '==', currentUserId),
          limit(5)
        );

        const receivedMessagesSnapshot = await getDocs(receivedMessagesQuery);
        if (!receivedMessagesSnapshot.empty) {
          for (const msgDoc of receivedMessagesSnapshot.docs) {
            const msgData = msgDoc.data();
            const otherUserId = msgData['senderId'];

            if (otherUserId && otherUserId !== currentUserId) {
              this.setSelectedUser(otherUserId);
              this.setIsDirectMessage(true);
              const dmRoute = `/workspace/dm/${otherUserId}`;
              return dmRoute;
            }
          }
        }

        // Gesendete Nachrichten prüfen
        const sentMessagesQuery = query(
          messagesRef,
          where('senderId', '==', currentUserId),
          limit(5)
        );

        const sentMessagesSnapshot = await getDocs(sentMessagesQuery);
        if (!sentMessagesSnapshot.empty) {
          for (const msgDoc of sentMessagesSnapshot.docs) {
            const msgData = msgDoc.data();
            const otherUserId = msgData['recipientId'];

            if (otherUserId && otherUserId !== currentUserId) {
              this.setSelectedUser(otherUserId);
              this.setIsDirectMessage(true);
              const dmRoute = `/workspace/dm/${otherUserId}`;
              return dmRoute;
            }
          }
        }
      } catch (dmError) {
        console.error('❌ DEBUG: Error finding DMs:', dmError);
      }

      // Wenn weder Channels noch DMs gefunden wurden
      this.setIsDirectMessage(false);
      this.selectedChannelSubject.next('');
      this.setSelectedUser('');
      return '/workspace';

    } catch (error) {
      console.error('❌ DEBUG: Error in selectNextAvailableChannel:', error);
      return '/workspace';
    } finally {
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

  async selectChannel(channelId: string) {
    try {
      // Channel-Daten laden
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelSnap = await getDoc(channelRef);
      
      if (channelSnap.exists()) {
        const channelData = channelSnap.data();
        
        // Channel-Name aus den Daten verwenden
        this.selectedChannelSubject.next(channelData['name']);
        this.setCurrentChannelId(channelId);
        this.setIsDirectMessage(false);
        
        // Nachrichten für diesen Channel laden
        await this.loadMessages(channelId, null);

      } else {
        console.error('❌ Channel nicht gefunden:', channelId);
      }
    } catch (error) {
      console.error('❌ Fehler beim Auswählen des Channels:', error);
    }
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
        avatar: currentUser.avatar,
        isThread: true
      };

      await addDoc(messagesRef, replyData);
      this.audioService.playMessageSound();
    } catch (error) {
      console.error('Error sending thread reply:', error);
      throw error;
    }
  }

  // Methode zum Laden der Nachrichten
  async loadMessages(channelId: string | null, recipientId: string | null) {
    // Erst alte Subscription beenden
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }

    const messagesRef = collection(this.firestore, 'messages');
    let q: Query<DocumentData>;

    if (channelId) {
      q = query(
        messagesRef,
        where('channelId', '==', channelId),
        orderBy('timestamp', 'asc')
      );
    } else if (recipientId) {
      const currentUser = await this.getCurrentUser();
      q = query(
        messagesRef,
        where('recipientId', 'in', [recipientId, currentUser.uid]),
        where('userId', 'in', [recipientId, currentUser.uid]),
        orderBy('timestamp', 'asc')
      );
    } else {
      q = query(messagesRef, orderBy('timestamp', 'asc'));
    }

    // Neue Subscription speichern
    this.messageSubscription = collectionData(q).subscribe(messages => {

      // Deduplizierung der Nachrichten basierend auf ID
      const uniqueMessages = Array.from(
        new Map(messages.map(m => [m['id'], m])).values()
      );

      this.messagesSubject.next(uniqueMessages as Message[]);
    });
  }

  async openThread(messageId: string) {
    try {
      const messageRef = doc(this.firestore, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      
      if (messageSnap.exists()) {
        const messageData = messageSnap.data();
        this.setThreadMessage({
          id: messageSnap.id,
          ...messageData
        } as Message);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error opening thread:', error);
      return false;
    }
  }

  // Cleanup Methode
  cleanup() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.messagesSubject.next([]);
  }

  setHighlightMessage(messageId: string) {
    this.highlightMessageSubject.next(messageId);
    // Reset nach 2 Sekunden
    setTimeout(() => {
      this.highlightMessageSubject.next('');
    }, 2000);
  }

  triggerScrollToMessage(messageId: string) {
    this.scrollToMessageSubject.next(messageId);
    // Highlight die Nachricht
    this.setHighlightMessage(messageId);
  }

  // Neue Methode zum Prüfen des Channel-Zugriffs
  async hasChannelAccess(channelId: string): Promise<boolean> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) return false;

      // Front-End-Team Channel ist ein Spezialfall
      if (channelId === 'Front-End-Team') {
        return true;
      }

      // Prüfe ob der Channel existiert
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelSnap = await getDoc(channelRef);
      
      if (!channelSnap.exists()) {
        return false;
      }

      // Prüfe Mitgliedschaft in channelMembers Collection
      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const q = query(
        channelMembersRef,
        where('userId', '==', currentUser.uid),
        where('channelId', '==', channelId)
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking channel access:', error);
      return false;
    }
  }

  // Neue Methode zum Abrufen aller zugänglichen Channels
  async getUserAccessibleChannels(): Promise<string[]> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) return [];

      const accessibleChannels: string[] = ['Front-End-Team']; // Standard-Channel

      // Hole alle Channel-Mitgliedschaften des Users
      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const q = query(
        channelMembersRef,
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(doc => {
        const channelId = doc.data()['channelId'];
        if (channelId && !accessibleChannels.includes(channelId)) {
          accessibleChannels.push(channelId);
        }
      });

      return accessibleChannels;
    } catch (error) {
      console.error('Error getting accessible channels:', error);
      return ['Front-End-Team']; // Fallback auf Standard-Channel
    }
  }
}