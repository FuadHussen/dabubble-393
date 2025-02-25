import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp, updateDoc } from '@angular/fire/firestore';
import { Message } from '../../models/message.model';
import { ChatService } from './../../services/chat.service';
import { Auth } from '@angular/fire/auth';
import { trigger, transition, style, animate } from '@angular/animations';
import { AvatarService } from '../../services/avatar.service';
interface MessageGroup {
  date: string;
  messages: Message[];
  isOriginalMessage: boolean;
  avatar: string;
}

interface Reaction {
  userId: string;
  emoji: string;
  timestamp: Date;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    MatButtonModule, 
    FormsModule
  ],
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('300ms ease-out', style({ transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateX(100%)' }))
      ])
    ])
  ]
})
export class ThreadComponent implements OnInit, OnDestroy {
  @Input() message: Message | null = null;
  @Input() isMobile: boolean = false;
  @Output() closeThread = new EventEmitter<void>();

  replies: Message[] = [];
  replyText: string = '';
  showEmojiPicker = false;
  currentUser: any;

  emojis: string[] = ['😀', '😂', '😊', '😍', '🥰', '😎', '😴', '🤔'];
  messageGroups: MessageGroup[] = [];
  tooltipVisibility: { [key: string]: boolean } = {};
  tooltipData: { [key: string]: { emoji: string, users: string[] } } = {};

  // Cache für gruppierte Reaktionen
  private reactionCache: { [key: string]: GroupedReaction[] } = {};
  private unsubscribes: (() => void)[] = [];

  constructor(
    private chatService: ChatService,
    private auth: Auth,
    private firestore: Firestore,
    private cdr: ChangeDetectorRef,
    private avatarService: AvatarService
  ) {
    this.chatService.getCurrentUser().then(user => {
      this.currentUser = user;
    });
  }

  ngOnInit() {
    this.loadReplies();
  }

  addReaction(message: Message, emoji: string) {
    this.handleReactionClick(new Event(''), message, { emoji, count: 0, users: [] });
  }

  // Methode für die Anzeige des Benutzernamens
  getDisplayName(message: any): string {
    return message?.username || 'Unbekannter Benutzer';
  }

  // Hilfsmethode für die Timestamp-Konvertierung
  convertTimestamp(timestamp: any): Date {
    if (timestamp && timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    return new Date();
  }

  isCurrentUser(userId: string | undefined): boolean {
    return userId === this.auth.currentUser?.uid;
  }

  groupMessagesByDate(messages: Message[]) {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach(message => {
      const date = this.convertTimestamp(message.timestamp);
      const dateStr = date.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });

      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(message);
    });

    this.messageGroups = Object.keys(groups).map(date => ({
      date,
      messages: groups[date],
      isOriginalMessage: false,
      avatar: ''
    }));
  }

  async loadReplies() {
    if (this.message) {
      try {
        // Echtzeit-Listener für die Original-Nachricht
        const originalMessageRef = doc(this.firestore, 'messages', this.message.id);
        const unsubscribeOriginal = onSnapshot(originalMessageRef, async (docSnapshot) => {
          if (docSnapshot.exists()) {
            const messageData = docSnapshot.data();
            
            // Hole den User mit der userId aus der users-Sammlung
            const userRef = doc(this.firestore, 'users', messageData['userId']);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            
            const originalMessageData = {
              id: docSnapshot.id,
              ...messageData,
              // Verwende den Avatar aus dem user-Dokument
              avatar: userData?.['avatar'],
              username: userData?.['username'] || messageData['username']
            } as Message;
            
            this.message = originalMessageData;
            
            // Erstelle die Gruppe für die Original-Nachricht
            const originalMessageGroup = {
              date: this.convertTimestamp(originalMessageData.timestamp).toLocaleDateString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              }),
              messages: [originalMessageData],
              isOriginalMessage: true,
              avatar: originalMessageData.avatar || ''
            };

            // Wenn es bereits Gruppen gibt, ersetze die erste (Original-Nachricht)
            if (this.messageGroups.length > 0) {
              this.messageGroups[0] = originalMessageGroup;
            } else {
              this.messageGroups = [originalMessageGroup];
            }
            
            this.cdr.detectChanges();
          }
        });
        this.unsubscribes.push(unsubscribeOriginal);

        // Echtzeit-Listener für die Antworten
        const messagesRef = collection(this.firestore, 'messages');
        const q = query(
          messagesRef,
          where('threadId', '==', this.message.id),
          orderBy('timestamp', 'asc')
        );

        const unsubscribeReplies = onSnapshot(q, async (snapshot) => {
          // Lade für jede Antwort die User-Daten
          this.replies = await Promise.all(
            snapshot.docs.map(async (docSnapshot) => {
              const messageData = docSnapshot.data();
              
              // Hole den User für jede Antwort
              const userRef = doc(this.firestore, 'users', messageData['userId']);
              const userSnap = await getDoc(userRef);
              const userData = userSnap.data();
              
              return {
                id: docSnapshot.id,
                ...messageData,
                // Verwende den Avatar aus dem user-Dokument
                avatar: userData?.['avatar'],
                username: userData?.['username'] || messageData['username']
              } as Message;
            })
          );

          // Gruppiere die Antworten nach Datum
          const replyGroups = this.groupRepliesByDate(this.replies);
          
          // Behalte die Original-Nachricht-Gruppe und füge die Antwort-Gruppen hinzu
          this.messageGroups = [this.messageGroups[0], ...replyGroups];
          
          this.cdr.detectChanges();
        });
        this.unsubscribes.push(unsubscribeReplies);

      } catch (error) {
        console.error('Error loading thread:', error);
      }
    }
  }

  private groupRepliesByDate(replies: Message[]): MessageGroup[] {
    const groups: { [key: string]: Message[] } = {};

    replies.forEach(message => {
      const date = this.convertTimestamp(message.timestamp);
      const dateStr = date.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });

      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(message);
    });

    return Object.keys(groups).map(date => ({
      date,
      messages: groups[date],
      isOriginalMessage: false,
      avatar: ''
    }));
  }

  async sendReply() {
    if (this.message && this.replyText.trim() && this.currentUser) {
      try {
        // Hole den aktuellen User aus Firestore um die korrekten Daten zu haben
        const userRef = doc(this.firestore, 'users', this.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        const replyData = {
          text: this.replyText.trim(),
          userId: this.currentUser.uid,
          // Verwende die richtige Reihenfolge für den Username mit Index-Notation
          username: userData?.['displayName'] ||
            userData?.['username'] ||
            this.currentUser['username'] ||
            this.currentUser.email,
          channelId: this.message.channelId,
          threadId: this.message.id,
          timestamp: new Date(),
          avatar: userData?.['avatar'] ||
            this.currentUser['avatar']
        };

        await this.chatService.sendMessage(replyData);
        this.replyText = '';
      } catch (error) {
        console.error('Error sending reply:', error);
      }
    }
  }

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string) {
    this.replyText += emoji;
    this.showEmojiPicker = false;
  }

  close() {
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];
    this.closeThread.emit();
  }

  closeEmojiPicker() {
    this.messageGroups.forEach(group => {
      group.messages.forEach(msg => {
        msg.showEmojiPicker = false;
      });
    });
  }

  // Reaktions-Methoden
  showReactionOptions(event: MouseEvent, message: Message) {
    event.stopPropagation();
    message.showReactions = true;
  }

  hideReactionOptions(event: MouseEvent, message: Message) {
    const target = event.currentTarget as HTMLElement;
    if (!target.querySelector('.message-emoji-picker:hover')) {
      message.showReactions = false;
      message.showEmojiPicker = false;
    }
  }

  async handleReactionClick(event: Event, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();

    if (!this.currentUser?.uid) return;

    try {
      const messageRef = doc(this.firestore, 'messages', message.id);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) return;

      const currentReactions: Reaction[] = messageDoc.data()?.['reactions'] || [];
      const existingReactionIndex = currentReactions.findIndex(r =>
        r.userId === this.currentUser.uid && r.emoji === reaction.emoji
      );

      let updatedReactions: Reaction[];
      if (existingReactionIndex !== -1) {
        updatedReactions = currentReactions.filter((_, index) => index !== existingReactionIndex);
      } else {
        updatedReactions = [...currentReactions, {
          userId: this.currentUser.uid,
          emoji: reaction.emoji,
          timestamp: new Date()
        }];
      }

      await updateDoc(messageRef, { reactions: updatedReactions });

      // Cache für diese Nachricht zurücksetzen
      Object.keys(this.reactionCache).forEach(key => {
        if (key.startsWith(message.id)) {
          delete this.reactionCache[key];
        }
      });

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  }

  groupReactions(reactions: Reaction[], messageId: string): GroupedReaction[] {
    const cacheKey = `${messageId}-${JSON.stringify(reactions)}`;

    // Prüfe Cache
    if (this.reactionCache[cacheKey]) {
      return this.reactionCache[cacheKey];
    }

    if (!reactions || reactions.length === 0) return [];

    const grouped = reactions.reduce((acc: { [key: string]: GroupedReaction }, reaction: Reaction) => {
      if (!reaction.emoji || !reaction.userId) return acc;

      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        };
      }

      if (!acc[reaction.emoji].users.includes(reaction.userId)) {
        acc[reaction.emoji].users.push(reaction.userId);
        acc[reaction.emoji].count++;
      }

      return acc;
    }, {});

    const result = Object.values(grouped);
    this.reactionCache[cacheKey] = result;
    return result;
  }

  hasUserReacted(message: Message, emoji: string) {
    return message.reactions?.some(r =>
      r.userId === this.currentUser.uid && r.emoji === emoji
    );
  }

  handleReactionHover(event: Event, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();
    const tooltipKey = `${message.id}-${reaction.emoji}`;
    this.tooltipVisibility[tooltipKey] = true;
  }

  hideTooltip(tooltipKey: string) {
    this.tooltipVisibility[tooltipKey] = false;
  }

  getAvatarPath(msg: Message): string {
    if (!msg.avatar) {
    }
    return `assets/img/avatars/${msg.avatar}`;
  }

  toggleReactionPicker(message: Message) {
    // Schließe alle anderen offenen Emoji-Picker
    this.messageGroups.forEach(group => {
      group.messages.forEach(msg => {
        if (msg.id !== message.id) {
          msg.showEmojiPicker = false;
        }
      });
    });
    
    // Toggle den Emoji-Picker für die aktuelle Nachricht
    message.showEmojiPicker = !message.showEmojiPicker;
  }

  ngOnDestroy() {
    // Cleanup aller Unsubscribe-Funktionen
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];
  }

  getAvatarSrc(avatar: string | null): string {
    if (!avatar) return '';
    
    if (this.avatarService.isGoogleAvatar(avatar)) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }
    
    return 'assets/img/avatars/' + avatar;
  }
}
