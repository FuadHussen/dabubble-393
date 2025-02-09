import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, query, where, orderBy, onSnapshot, collectionData, Timestamp, serverTimestamp, addDoc } from '@angular/fire/firestore';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../services/user.service';
import { FormsModule } from '@angular/forms';

interface Message {
  id: string;
  text: string;
  timestamp: any;
  userId: string;
  username: string;
  avatar?: string;
  channelId?: string;
  recipientId?: string;
}

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
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss'
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

  constructor(
    private firestore: Firestore,
    private chatService: ChatService,
    private userService: UserService
  ) {
    // Users aus Firestore laden mit ID
    const usersCollection = collection(this.firestore, 'users');
    collectionData(usersCollection, { idField: 'id' }).subscribe(users => {
      this.users = users.map(user => ({
        ...user,
        avatar: user['avatar'] || null
      })) as User[];
    });


    // Subscribe to channel changes
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
      this.isDirectMessage = false;
      if (channel) {
        this.loadMessages();
      }
    });

    // Subscribe to direct message changes
    this.chatService.selectedUser$.subscribe(userId => {
      if (userId) {
        this.isDirectMessage = true;
        this.loadMessages();
      }
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });
  }

  ngOnInit() {
    this.loadMessages();
  }

  async loadMessages() {
    try {
      this.currentUser = await this.chatService.getCurrentUser();

      if (this.isDirectMessage) {
        const selectedUserId = this.chatService.selectedUser;
        if (selectedUserId && this.currentUser) {
          const messagesRef = collection(this.firestore, 'messages');
          const q = query(
            messagesRef,
            where('recipientId', 'in', [selectedUserId, this.currentUser.uid]),
            where('userId', 'in', [selectedUserId, this.currentUser.uid]),
            orderBy('timestamp', 'asc')
          );

          if (this.messagesSubscription) {
            this.messagesSubscription();
          }

          this.messagesSubscription = onSnapshot(q, (querySnapshot) => {
            const messages: Message[] = [];
            querySnapshot.docs.forEach(doc => {
              const messageData = doc.data();
              const user = this.users.find(u => u.uid === messageData['userId']);

              messages.push({
                id: doc.id,
                ...messageData,
                avatar: user?.avatar || 'sofia-mueller-avatar.png'

              } as Message);
            });

            this.messages = messages;
            this.groupMessagesByDate();
            this.chatService.setHasMessages(this.messages.length > 0);

          });
        }
      } else {
        if (this.selectedChannel) {
          const messagesRef = collection(this.firestore, 'messages');
          const q = query(
            messagesRef,
            where('channelId', '==', this.selectedChannel),
            orderBy('timestamp', 'asc')
          );

          if (this.messagesSubscription) {
            this.messagesSubscription();
          }

          this.messagesSubscription = onSnapshot(q, (querySnapshot) => {
            const messages: Message[] = [];
            querySnapshot.docs.forEach(doc => {
              const messageData = doc.data();
              const user = this.users.find(u => u.uid === messageData['userId']);

              messages.push({
                id: doc.id,
                ...messageData,
                avatar: user?.avatar || 'sofia-mueller-avatar.png'
              } as Message);
            });

            this.messages = messages;
            this.groupMessagesByDate();
            this.chatService.setHasMessages(this.messages.length > 0);

          });
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  ngOnDestroy() {
    if (this.messagesSubscription) {
      this.messagesSubscription();
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
    return userId === 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z1';
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
      const messagesRef = collection(this.firestore, 'messages');

      const messageData = {
        text: this.messageText.trim(),
        timestamp: new Date(),
        userId: this.currentUser.uid,
        username: this.currentUser.username || 'Unbekannt',
        channelId: this.isDirectMessage ? null : this.selectedChannel,
        recipientId: this.isDirectMessage ? this.chatService.selectedUser : null
      };

      await addDoc(messagesRef, messageData);
      this.messageText = '';
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  scrollToBottom() {
    // Implement the logic to scroll to the bottom of the message container
  }
}
