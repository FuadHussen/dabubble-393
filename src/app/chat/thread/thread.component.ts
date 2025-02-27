import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
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
import { UserService } from '../../services/user.service';

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
  @ViewChild('replyTextarea') replyTextarea!: ElementRef;

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

  // Add a map to cache user data
  private userCache: { [userId: string]: any } = {};

  private shouldFocusTextarea = false;

  // Füge diese neue Property und Methode hinzu
  tooltipPositions: { [key: string]: { top: number, left: number } } = {};

  constructor(
    public chatService: ChatService,
    private auth: Auth,
    private firestore: Firestore,
    private cdr: ChangeDetectorRef,
    private avatarService: AvatarService,
    private userService: UserService,
    private ngZone: NgZone
  ) {
    this.chatService.getCurrentUser().then(user => {
      this.currentUser = user;
    });
  }

  ngOnInit() {
    this.loadReplies();
    
    // Replace the existing user data subscription with this improved version
    const userDataSub = this.userService.userData$.subscribe(userData => {
      if (userData && userData.uid) {
        // Update cached user data - PROPERLY MERGE old and new data
        this.userCache[userData.uid] = {
          ...this.userCache[userData.uid] || {},
          ...userData
        };
        
        // Update message if it matches this user
        if (this.message && this.message.userId === userData.uid) {
          this.message = {
            ...this.message,
            username: userData.username || this.message.username,  // Only update if provided
            avatar: userData.avatar !== undefined ? userData.avatar : this.message.avatar  // Only update if provided
          };
        }
        
        // Update replies if they match this user
        this.replies = this.replies.map(reply => {
          if (reply.userId === userData.uid) {
            return {
              ...reply,
              username: userData.username || reply.username,  // Only update if provided
              avatar: userData.avatar !== undefined ? userData.avatar : reply.avatar  // Only update if provided
            };
          }
          return reply;
        });
        
        // Update message groups to reflect changes
        this.messageGroups = this.messageGroups.map(group => {
          return {
            ...group,
            messages: group.messages.map(msg => {
              if (msg.userId === userData.uid) {
                return {
                  ...msg,
                  username: userData.username || msg.username,  // Only update if provided
                  avatar: userData.avatar !== undefined ? userData.avatar : msg.avatar  // Only update if provided
                };
              }
              return msg;
            })
          };
        });
        
        // Trigger change detection
        this.cdr.detectChanges();
      }
    });
    
    // Add to unsubscribes for cleanup
    this.unsubscribes.push(() => userDataSub.unsubscribe());

    // Füge diese neue Subscription hinzu
    const threadMessageSub = this.chatService.threadMessage$.subscribe(message => {
      if (message) {
        this.shouldFocusTextarea = true;
        this.focusTextarea();
      }
    });
    
    // Füge zur Cleanup-Liste hinzu
    this.unsubscribes.push(() => threadMessageSub.unsubscribe());
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
            
            // Use getUserData helper method instead of direct query
            const userData = await this.getUserData(messageData['userId']);
            
            const originalMessageData = {
              id: docSnapshot.id,
              ...messageData,
              // Use data from userData
              avatar: userData?.avatar,
              username: userData?.username || messageData['username']
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
          // Use getUserData for each reply
          this.replies = await Promise.all(
            snapshot.docs.map(async (docSnapshot) => {
              const messageData = docSnapshot.data();
              
              // Use getUserData helper
              const userData = await this.getUserData(messageData['userId']);
              
              return {
                id: docSnapshot.id,
                ...messageData,
                avatar: userData?.avatar,
                username: userData?.username || messageData['username']
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
    // Schließt den globalen Emoji-Picker für das Textfeld
    this.showEmojiPicker = false;
    
    // Schließt auch die Emoji-Picker für alle Nachrichten
    this.messageGroups.forEach(group => {
      group.messages.forEach(msg => {
        if (msg.showEmojiPicker) {
          msg.showEmojiPicker = false;
        }
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
    
    // Position berechnen
    const targetElement = event.currentTarget as HTMLElement;
    const rect = targetElement.getBoundingClientRect();
    
    this.tooltipPositions[tooltipKey] = {
      top: rect.top - 10 - 80, // Höhe von tooltip + Abstand
      left: rect.left + (rect.width / 2)
    };
    
    this.tooltipVisibility[tooltipKey] = true;
    
    // Tooltip-Daten setzen
    this.tooltipData[tooltipKey] = {
      emoji: reaction.emoji,
      users: reaction.users
    };
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
    // Clean up all subscriptions
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];
  }

  getAvatarSrc(avatar: string | null | undefined): string {
    if (!avatar) return 'assets/img/avatars/default-avatar.png';
    
    if (this.avatarService.isGoogleAvatar(avatar) || avatar.startsWith('http')) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }
    
    return 'assets/img/avatars/' + avatar;
  }

  // Add this helper method to get and cache user data
  private async getUserData(userId: string) {
    // Check cache first
    if (this.userCache[userId]) {
      return this.userCache[userId];
    }
    
    // If not in cache, get from Firestore
    try {
      const userRef = doc(this.firestore, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Store in cache
        this.userCache[userId] = userData;
        return userData;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching user data for ${userId}:`, error);
      return null;
    }
  }

  // Add this method
  focusTextarea() {
    // Use NgZone to ensure this runs after view initialization
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (this.replyTextarea?.nativeElement) {
          this.replyTextarea.nativeElement.focus();
        }
      });
    });
  }

  // Modify the existing ngAfterViewChecked lifecycle hook or add it if it doesn't exist
  ngAfterViewChecked() {
    if (this.shouldFocusTextarea && this.replyTextarea?.nativeElement) {
      this.focusTextarea();
      this.shouldFocusTextarea = false;
    }
  }

  // Helper method to get username from user ID
  getUserName(userId: string): string {
    const userData = this.userCache[userId];
    return userData?.username || 'Unknown User';
  }

  getTooltipPosition(tooltipKey: string) {
    return this.tooltipPositions[tooltipKey] || { top: 0, left: 0 };
  }
}
