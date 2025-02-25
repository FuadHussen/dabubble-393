import { Component, OnInit, ChangeDetectorRef, NgZone, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, query, where, orderBy, onSnapshot, collectionData, Timestamp, serverTimestamp, addDoc, doc, updateDoc, getDocs } from '@angular/fire/firestore';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../services/user.service';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AudioService } from '../../services/audio.service';
import { MessageReactionHandler } from './message-reaction.handler';
import { MessageUIHandler } from './message-ui.handler';
import { MessageGroupHandler } from './message-group.handler';
import { Message, Reaction, GroupedReaction, TooltipData } from '../../models/message.model';

interface User {
  id: string;
  username: string;
  displayName?: string;
  uid?: string;
  avatar?: string;
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
  // State
  currentUser: any;
  messages: Message[] = [];
  messageGroups: { date: string, messages: Message[], showDateDivider: boolean }[] = [];
  selectedChannel: string = '';
  isDirectMessage: boolean = false;
  selectedUserDisplayName: string = '';
  hasMessages: boolean = false;
  users: User[] = [];
  threadReplies: Message[] = [];
  selectedThread: Message | null = null;
  selectedUserData: any = null;
  
  // UI State
  tooltipVisibility: { [key: string]: boolean } = {};
  tooltipData: { [key: string]: TooltipData } = {};
  emojis: string[] = [
    '😀', '😂', '😊', '😍', '🥰', '😎', '😴', '🤔', 
    '😅', '😭', '😤', '😡', '🥺', '😳', '🤯', '🤮', 
    '🥳', '😇', '🤪', '🤓', '👍', '👎', '👋', '🙌', 
    '👏', '🤝', '🙏', '💪', '🫶', '❤️', '🔥', '💯', 
    '✨', '🎉', '👻', '🤖', '💩', '🦄'
  ];
  
  // Scroll handling
  private isUserScrolling = false;
  private shouldScrollToBottom = true;
  private scrollTimeout: any;
  private messagesSubscription: (() => void) | undefined;
  
  @ViewChild('chatContent') private chatContent!: ElementRef;

  constructor(
    private firestore: Firestore,
    private chatService: ChatService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private audioService: AudioService,
    public reactionHandler: MessageReactionHandler,
    public uiHandler: MessageUIHandler,
    public groupHandler: MessageGroupHandler
  ) {
    // Users aus Firestore laden
    const usersCollection = collection(this.firestore, 'users');
    collectionData(usersCollection, { idField: 'id' }).subscribe(users => {
      this.users = users.map(user => ({
        ...user,
        avatar: user['avatar'] || null
      })) as User[];
    });

    // Channel und User Subscriptions
    this.setupSubscriptions();
  }

  ngOnInit() {
    if (this.selectedChannel || this.chatService.selectedUser) {
      this.loadMessages();
    }
  }

  private setupSubscriptions() {
    this.chatService.selectedChannel$.subscribe(channel => {
      this.messages = [];
      this.messageGroups = [];
      this.selectedChannel = channel;
      this.isDirectMessage = false;
      
      if (channel) {
        this.loadUsers().then(() => {
          this.loadMessages();
        });
      }
    });

    this.chatService.selectedUser$.subscribe(userId => {
      this.messages = [];
      this.messageGroups = [];
      this.isDirectMessage = true;
      
      if (userId) {
        this.loadUsers().then(() => {
          this.loadMessages();
        });
      }
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });

    this.chatService.selectedUserData$.subscribe(userData => {
      this.selectedUserData = userData;
    });
  }

  private async loadUsers() {
    const usersCollection = collection(this.firestore, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    this.users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        avatar: doc.data()['avatar'] || null
    })) as User[];
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
        
        if (!selectedUserId || !this.currentUser) {
          return;
        }

        q = query(
          messagesRef,
          where('recipientId', 'in', [selectedUserId, this.currentUser.uid]),
          where('userId', 'in', [selectedUserId, this.currentUser.uid]),
          orderBy('timestamp', 'asc')
        );
      } else {
        if (!this.selectedChannel) {
          return;
        }        
        
        // Laden Sie alle Nachrichten im Channel
        q = query(
          messagesRef,
          where('channelId', '==', this.selectedChannel),
          orderBy('timestamp', 'asc')
        );
      }

      // Thread-Nachrichten separat laden
      const threadQuery = query(
        messagesRef,
        where('threadId', '!=', null),
        orderBy('threadId'),
        orderBy('timestamp', 'asc')
      );

      onSnapshot(threadQuery, (snapshot) => {
        this.threadReplies = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
      });

      this.messagesSubscription = onSnapshot(q, (snapshot) => {
        this.ngZone.run(async () => {
          const newMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Message));

          const filteredMessages = newMessages.filter(message => !message.threadId);

          await this.setAvatarsForMessages(filteredMessages);

          this.messages = filteredMessages;
          this.messageGroups = this.groupHandler.groupMessagesByDate(this.messages);
          this.hasMessages = this.messages.length > 0;
          
          if (this.hasMessages) {
            this.chatService.setHasMessages(true);
            
            setTimeout(() => {
              const messageElements = document.querySelectorAll('.message');
              if (messageElements.length > 0) {
                const lastMessage = messageElements[messageElements.length - 1];
                lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            }, 100);
          } else {
            this.chatService.setHasMessages(false);
          }
          
          this.cdr.detectChanges();
        });
      });
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  // UI Event Handlers
  showReactionOptions(event: Event, message: Message) {
    this.uiHandler.showReactionOptions(message);
  }

  hideReactionOptions(event: MouseEvent, message: Message) {
    this.uiHandler.hideReactionOptions(event, message);
  }

  showEmojiPickerForMessage(event: Event, message: Message) {
    this.uiHandler.showEmojiPickerForMessage(event, message);
  }

  toggleEditMenu(event: MouseEvent, message: Message) {
    // Schließe alle anderen offenen Menüs
    this.messages.forEach(m => {
      if (m !== message) m.showEditMenu = false;
    });
    this.uiHandler.toggleEditMenu(event, message);
  }

  startEditingMessage(message: Message) {
    this.uiHandler.startEditingMessage(message);
  }

  cancelEdit(message: Message) {
    this.uiHandler.cancelEdit(message);
  }

  // Reaction Handlers
  groupReactions(reactions: Reaction[], messageId: string): GroupedReaction[] {
    return this.reactionHandler.groupReactions(reactions, messageId);
  }

  hasUserReacted(message: Message, emoji: string): boolean {
    return this.reactionHandler.hasUserReacted(message, emoji, this.currentUser?.uid);
  }

  async handleReactionClick(event: Event, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();
    await this.reactionHandler.handleReactionClick(message, reaction, this.currentUser?.uid);
    this.cdr.detectChanges();
  }

  handleReactionHover(event: Event, message: Message, reaction: GroupedReaction) {
    event.stopPropagation();
    const result = this.uiHandler.handleReactionHover(message, reaction, this.tooltipData, this.tooltipVisibility);
    this.tooltipData = result.tooltipData;
    this.tooltipVisibility = result.tooltipVisibility;
  }

  hideTooltip(tooltipKey: string) {
    this.tooltipVisibility = this.uiHandler.hideTooltip(tooltipKey, this.tooltipVisibility);
  }

  // Message Actions
  async saveEditedMessage(message: Message) {
    try {
      if (!message.editText?.trim()) return;

      const messageRef = doc(this.firestore, 'messages', message.id);
      await updateDoc(messageRef, {
        text: message.editText,
        edited: true,
        editedAt: serverTimestamp()
      });

      message.text = message.editText;
      message.isEditing = false;
      message.editText = '';
    } catch (error) {
      console.error('Error updating message:', error);
    }
  }

  openThread(event: Event, message: Message) {
    event.stopPropagation();
    this.selectedThread = message;
    this.chatService.setThreadMessage(message);
  }

  async sendReply(threadMessage: Message, replyText: string) {
    try {
      const messageData = {
        text: replyText,
        userId: this.currentUser.uid,
        username: this.currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        channelId: threadMessage.channelId,
        threadId: threadMessage.id,
        avatar: this.currentUser.avatar
      };

      await addDoc(collection(this.firestore, 'messages'), messageData);
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  }

  // Helper Methods
  isCurrentUser(userId: string): boolean {
    return userId === this.currentUser?.uid;
  }

  getUserName(userId: string): string {
    const user = this.users.find(u => u.uid === userId || u.id === userId);
    return user ? user.username : 'Unbekannt';
  }

  getThreadRepliesCount(messageId: string): number {
    return this.groupHandler.getThreadRepliesCount(messageId, this.threadReplies);
  }

  getAvatarSrc(avatar: string | null): string {
    return this.uiHandler.getAvatarSrc(avatar);
  }

  // Scroll Handling
  @HostListener('document:mouseover', ['$event'])
  onDocumentMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.reaction-badge') && !target.closest('.reaction-tooltip')) {
      this.tooltipVisibility = this.uiHandler.hideAllTooltips();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress() {
    this.messages.forEach(message => {
      if (message.isEditing) {
        this.cancelEdit(message);
      }
    });
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

  async setAvatarsForMessages(messages: Message[]): Promise<void> {
    // Erstellen Sie eine Map von Benutzer-IDs zu Avataren, um doppelte Abfragen zu vermeiden
    const avatarMap: { [key: string]: string } = {};

    for (const message of messages) {
      const userId = message.userId || message.recipientId;
      if (userId && !avatarMap[userId]) {
        const user = this.users.find(u => u.uid === userId || u.id === userId);
        avatarMap[userId] = user?.avatar || '';
      }
    }

    for (const message of messages) {
      const userId = message.userId || message.recipientId;
      if (userId) {
        message.avatar = avatarMap[userId];
      }
    }
  }
}