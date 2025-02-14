import { Component, OnInit, ChangeDetectorRef, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, query, where, orderBy, onSnapshot, collectionData, Timestamp, serverTimestamp, addDoc, doc, updateDoc, getDoc } from '@angular/fire/firestore';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../services/user.service';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { HostListener } from '@angular/core';
import { AudioService } from '../../services/audio.service';

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

interface Message {
  id: string;
  text: string;
  timestamp: any;
  userId: string;
  username: string;
  avatar?: string;
  channelId?: string;
  recipientId?: string;
  showReactions?: boolean;
  showEmojiPicker?: boolean;
  reactions?: Reaction[];
  showEditMenu?: boolean;
  isEditing?: boolean;
  editText?: string;
  threadId?: string;
}

interface User {
  id: string;
  username: string;
  displayName?: string;
  uid?: string;
  avatar?: string;
}

// Neues Interface für Tooltip-Daten
interface TooltipData {
  emoji: string;
  users: string[];
  position: {
    left: string;
    bottom: string;
  };
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss',
})

export class MessagesComponent implements OnInit {
  currentUser: any;
  messages: Message[] = [];
  messageGroups: { date: string, messages: Message[], showDateDivider: boolean }[] = [];
  selectedChannel: string = '';
  isDirectMessage: boolean = false;
  selectedUserDisplayName: string = '';
  hasMessages: boolean = false;
  private messagesSubscription: (() => void) | undefined;
  users: User[] = [];
  messageText: string = '';
  emojis: string[] = [
    '😀', '😂', '😊', '😍', '🥰', '😎', '😴', '🤔', 
    '😅', '😭', '😤', '😡', '🥺', '😳', '🤯', '🤮', 
    '🥳', '😇', '🤪', '🤓', '👍', '👎', '👋', '🙌', 
    '👏', '🤝', '🙏', '💪', '🫶', '❤️', '🔥', '💯', 
    '✨', '🎉', '👻', '🤖', '💩', '🦄'
  ];
  activeTooltipId: string | null = null;
  hoveredReactionId: string | null = null;
  emojiTooltipVisible = false;
  emojiTooltipData: { emoji: string, users: string[] } | null = null;
  emojiTooltipStyle: any = {};
  oneIsHovering = false;
  threadReplies: Message[] = [];

  hoveredReaction: GroupedReaction | null = null;
  tooltipX: number = 0;
  tooltipY: number = 0;

  tooltipVisibility: { [key: string]: boolean } = {};
  tooltipData: { [key: string]: TooltipData } = {};
  selectedUserData: any;
  selectedThread: Message | null = null;
  private isUserScrolling = false;
  private lastScrollTop = 0;
  private shouldScrollToBottom = true;
  private scrollTimeout: any;

  @ViewChild('chatContent') private chatContent!: ElementRef;

  constructor(
    private firestore: Firestore,
    private chatService: ChatService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private audioService: AudioService
  ) {
    // Users aus Firestore laden mit ID
    const usersCollection = collection(this.firestore, 'users');
    collectionData(usersCollection, { idField: 'id' }).subscribe(users => {
      this.users = users.map(user => ({
        ...user,
        avatar: user['avatar'] || null
      })) as User[];
    });

    // Modifiziere die Subscriptions
    this.chatService.selectedChannel$.subscribe(channel => {
      // Reset messages first
      this.messages = [];
      this.messageGroups = [];
      this.selectedChannel = channel;
      this.isDirectMessage = false;
      
      if (channel) {
        setTimeout(() => {
          this.loadMessages();
        });
      }
    });

    this.chatService.selectedUser$.subscribe(userId => {
      // Reset messages first
      this.messages = [];
      this.messageGroups = [];
      this.isDirectMessage = true;
      
      if (userId) {
        setTimeout(() => {
          this.loadMessages();
        });
      }
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });

    // Subscribe to user data changes
    this.chatService.selectedUserData$.subscribe(userData => {
      this.selectedUserData = userData;
    });
  }

  ngOnInit() {
    // Initial load only if we have a channel or user selected
    if (this.selectedChannel || this.chatService.selectedUser) {
      this.loadMessages();
    }
  }

  showTooltip(event: MouseEvent, reaction: GroupedReaction) {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.tooltipX = rect.left;
    this.tooltipY = rect.top - 120;
    this.hoveredReaction = reaction;
  }

  async loadMessages() {
    try {
      this.currentUser = await this.chatService.getCurrentUser();

      if (this.messagesSubscription) {
        this.messagesSubscription();
      }

      const messagesRef = collection(this.firestore, 'messages');
      let q;

      if (this.isDirectMessage) {
        const selectedUserId = this.chatService.selectedUser;
        if (!selectedUserId || !this.currentUser) return;

        q = query(
          messagesRef,
          where('recipientId', 'in', [selectedUserId, this.currentUser.uid]),
          where('userId', 'in', [selectedUserId, this.currentUser.uid]),
          orderBy('timestamp', 'asc')
        );
      } else {
        if (!this.selectedChannel) return;

        q = query(
          messagesRef,
          where('channelId', '==', this.selectedChannel),
          orderBy('timestamp', 'asc')
        );
      }

      // Separate Arrays für Hauptnachrichten und Thread-Antworten
      let mainMessages: Message[] = [];
      let threadReplies: Message[] = [];

      this.messagesSubscription = onSnapshot(q, async (querySnapshot) => {
        mainMessages = [];
        threadReplies = [];
        
        for (const docSnapshot of querySnapshot.docs) {
          const messageData = docSnapshot.data();
          const userRef = doc(this.firestore, 'users', messageData['userId']);
          const userDoc = await getDoc(userRef);
          const userData = userDoc.exists() ? userDoc.data() : null;

          const message = {
            id: docSnapshot.id,
            ...messageData,
            avatar: userData?.['avatar']
          } as Message;

          // Sortiere die Nachrichten in die entsprechenden Arrays
          if (messageData['threadId']) {
            threadReplies.push(message);
          } else {
            mainMessages.push(message);
          }
        }

        this.ngZone.run(() => {
          // Nur Hauptnachrichten im messages Array
          this.messages = mainMessages;
          // Thread-Antworten in separatem Array
          this.threadReplies = threadReplies;
          this.groupMessagesByDate();
          this.chatService.setHasMessages(this.messages.length > 0);
          
          if (this.messages.length > 0) {
            setTimeout(() => {
              const messageElements = document.querySelectorAll('.message');
              if (messageElements.length > 0) {
                const lastMessage = messageElements[messageElements.length - 1];
                lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            }, 100);
          }
          
          this.cdr.detectChanges();
        });
      });
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  ngOnDestroy() {
    if (this.messagesSubscription) {
      this.messagesSubscription();
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  groupMessagesByDate() {
    const groups = new Map<string, Message[]>();

    this.messages.forEach(message => {
      let date: Date;

      if (message.timestamp instanceof Timestamp) {
        date = message.timestamp.toDate();
      } else if (message.timestamp?.toDate) {
        date = message.timestamp.toDate();
      } else {
        date = new Date();
      }

      const dateStr = this.formatDate(date);

      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)?.push({
        ...message,
        timestamp: date
      });
    });

    this.messageGroups = Array.from(groups.entries()).map(([date, messages]) => ({
      date,
      messages,
      showDateDivider: this.isSameDay(new Date(date), new Date())
    }));
  }

  private formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(date, today)) {
      return 'Heute';
    } else if (this.isSameDay(date, yesterday)) {
      return 'Gestern';
    } else {
      return date.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear();
  }

  isCurrentUser(userId: string): boolean {
    // Für den Guest-Login (blaue Nachrichten)
    return userId === this.currentUser?.uid;
  }

  async sendMessage(event?: KeyboardEvent) {
    if (event && (event.key !== 'Enter' || event.shiftKey)) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    if (!this.messageText.trim() || !this.currentUser) return;

    try {
      const messageData = {
        text: this.messageText.trim(),
        userId: this.currentUser.uid,
        username: this.currentUser.username || 'Unbekannt',
        channelId: this.isDirectMessage ? null : this.selectedChannel,
        recipientId: this.isDirectMessage ? this.chatService.selectedUser : null,
        threadId: this.selectedThread ? this.selectedThread.id : null,
        timestamp: new Date()
      };

      // Nachricht über den ChatService senden
      const success = await this.chatService.sendMessage(messageData);
      
      if (success) {
        this.messageText = '';
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  showReactionOptions(event: MouseEvent, message: any) {
    message.showReactions = true;
  }

  hideReactionOptions(event: MouseEvent, message: any) {
    const target = event.currentTarget as HTMLElement;
    if (!target.querySelector('.message-emoji-picker:hover')) {
      message.showReactions = false;
      message.showEmojiPicker = false;
    }
  }

  showEmojiPickerForMessage(event: Event, message: any) {
    event.stopPropagation();
    message.showEmojiPicker = !message.showEmojiPicker;
  }

  getUserName(userId: string): string {
    const user = this.users.find(u => u.uid === userId);
    return user?.username || 'Unbekannter Nutzer';
  }

  groupReactions(reactions: Reaction[]): GroupedReaction[] {
    
    if (!reactions) return [];
    
    const grouped = reactions.reduce((acc: { [key: string]: GroupedReaction }, reaction: Reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        };
      }
      acc[reaction.emoji].count++;
      acc[reaction.emoji].users.push(reaction.userId);
      return acc;
    }, {});

    const result = Object.values(grouped);
    return result;
  }

  hasUserReacted(message: any, emoji: string) {
    return message.reactions?.some((r: any) => 
      r.userId === this.currentUser.uid && r.emoji === emoji
    );
  }

  async addReaction(message: any, emoji: string) {
    try {
      const messageRef = doc(this.firestore, 'messages', message.id);
      const reactions = message.reactions || [];
      
      const existingReaction = reactions.find(
        (r: any) => r.userId === this.currentUser.uid && r.emoji === emoji
      );

      if (existingReaction) {
        await updateDoc(messageRef, {
          reactions: reactions.filter((r: any) => 
            !(r.userId === this.currentUser.uid && r.emoji === emoji)
          )
        });
      } else {
        await updateDoc(messageRef, {
          reactions: [...reactions, {
            userId: this.currentUser.uid,
            emoji: emoji,
            timestamp: new Date()
          }]
        });
      }

      message.showEmojiPicker = false;
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  }

  toggleReaction(message: Message, reaction: GroupedReaction) {
    try {
      const messageRef = doc(this.firestore, 'messages', message.id);
      const reactions = message.reactions || [];

      const existingReaction = reactions.find(
        (r: Reaction) => r.userId === this.currentUser.uid && r.emoji === reaction.emoji
      );
      console.log(existingReaction);

      
      if (existingReaction) {
        // Reaktion entfernen
        updateDoc(messageRef, {
          reactions: reactions.filter((r: Reaction) => 
            !(r.userId === this.currentUser.uid && r.emoji === reaction.emoji)
          )
        });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  }

  @HostListener('document:mouseover', ['$event'])
  onDocumentMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const reactionBadge = target.closest('.reaction-badge');
    const tooltipElement = target.closest('.reaction-tooltip');
    
    // Wenn wir weder über einem Badge noch über dem Tooltip sind
    if (!reactionBadge && !tooltipElement) {
      // Alle Tooltips ausblenden
      this.hideAllTooltips();
    }
  }

  private hideAllTooltips() {
    // Alle Tooltip-Flags zurücksetzen
    this.tooltipVisibility = {};
    this.tooltipData = {};
  }

  handleReactionHover(event: MouseEvent, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();
    
    this.hideAllTooltips();
    
    const badge = (event.currentTarget as HTMLElement);
    const badgeRect = badge.getBoundingClientRect();
    
    // Berechne die Position basierend auf dem Index des Badges
    const reactionBadges = badge.parentElement?.parentElement?.querySelectorAll('.reaction-badge') || [];
    const badgeIndex = Array.from(reactionBadges).indexOf(badge);
    const baseOffset = 32; // Erhöhter Basis-Offset (von 112 auf 160)
    const offsetIncrement = 48; // Zusätzlicher Offset pro Badge
    
    const reactionKey = `${message.id}-${reaction.emoji}`;
    this.tooltipVisibility[reactionKey] = true;
    this.tooltipData[reactionKey] = {
      emoji: reaction.emoji,
      users: reaction.users,
      position: {
        left: `${baseOffset + (badgeIndex * offsetIncrement)}px`,
        bottom: `${window.innerHeight - badgeRect.top + 10}px`
      }
    };
  }

  handleReactionLeave(event: MouseEvent, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();
    const reactionKey = `${message.id}-${reaction.emoji}`;
    
    // Kurze Verzögerung beim Ausblenden
    setTimeout(() => {
      const target = event.relatedTarget as HTMLElement;
      const isOverTooltip = target?.closest('.reaction-tooltip');
      
      if (!isOverTooltip) {
        this.tooltipVisibility[reactionKey] = false;
        delete this.tooltipData[reactionKey];
      }
    }, 100);
  }

  private findMessageByEmoji(emoji: string) {
    return this.messages.find(message => 
      message.reactions?.some(reaction => reaction.emoji === emoji)
    );
  }

  toggleEditMenu(event: MouseEvent, message: any) {
    event.stopPropagation();
    // Schließe alle anderen offenen Menüs
    this.messages.forEach(m => {
      if (m !== message) m.showEditMenu = false;
    });
    message.showEditMenu = !message.showEditMenu;
  }

  startEditingMessage(message: Message) {
    // Schließe das Edit-Menü
    message.showEditMenu = false;
    
    // Aktiviere Edit-Modus und speichere original Text
    message.isEditing = true;
    message.editText = message.text;
  }

  async saveEditedMessage(message: Message) {
    try {
      if (!message.editText?.trim()) {
        return;
      }

      // Update in Firebase
      const messageRef = doc(this.firestore, 'messages', message.id);
      await updateDoc(messageRef, {
        text: message.editText,
        edited: true,
        editedAt: serverTimestamp()
      });

      // Update lokale Message
      message.text = message.editText;
      message.isEditing = false;
      message.editText = '';

    } catch (error) {
      console.error('Error updating message:', error);
    }
  }

  cancelEdit(message: Message) {
    message.isEditing = false;
    message.editText = '';
  }

  // Optional: ESC Taste zum Abbrechen
  @HostListener('document:keydown.escape')
  onEscapePress() {
    this.messages.forEach(message => {
      if (message.isEditing) {
        this.cancelEdit(message);
      }
    });
  }

  openThread(event: Event, message: Message) {
    event.stopPropagation();
    this.selectedThread = message;
    this.chatService.setThreadMessage(message);
  }

  onScroll(event: any) {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    const element = event.target;
    const currentScrollTop = element.scrollTop;
    const maxScrollTop = element.scrollHeight - element.clientHeight;
    
    this.shouldScrollToBottom = maxScrollTop - currentScrollTop < 50;
    this.isUserScrolling = true;
    
    this.scrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 300);
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom && !this.isUserScrolling && this.chatContent) {
      this.scrollToBottom();
    }
  }

  scrollToBottomManually() {
    if (this.chatContent) {
      this.shouldScrollToBottom = true;
      this.scrollToBottom();
    }
  }

  scrollToBottom(): void {
    if (this.chatContent) {
      this.chatContent.nativeElement.scrollTop = this.chatContent.nativeElement.scrollHeight;
    }
  }

  getThreadRepliesCount(messageId: string): number {
    // Nutze das threadReplies Array für die Zählung
    return this.threadReplies.filter(m => m.threadId === messageId).length;
  }

  async sendReply(threadMessage: Message, replyText: string) {
    try {
      const messageData = {
        text: replyText,
        userId: this.currentUser.uid,
        username: this.currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        channelId: threadMessage.channelId,
        threadId: threadMessage.id, // Wichtig: Setze die threadId auf die ID der Original-Nachricht
        avatar: this.currentUser.avatar
      };

      await addDoc(collection(this.firestore, 'messages'), messageData);
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  }
}