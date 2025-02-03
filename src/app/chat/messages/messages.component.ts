import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, addDoc, query, where, orderBy, onSnapshot, collectionData, Timestamp, serverTimestamp } from '@angular/fire/firestore';
import { ChatService } from '../../services/chat.service';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';
import { combineLatest, map, take } from 'rxjs';

interface Message {
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  channelId?: string;
  recipientId?: string;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss'
})
export class MessagesComponent implements OnInit {
  currentUser: any;
  messages: any[] = [];
  messageGroups: { date: string, messages: any[] }[] = [];
  selectedChannel: string = '';
  isDirectMessage: boolean = false;
  selectedUserDisplayName: string = '';
  hasMessages: boolean = false;
  messagesSubscription: any;
  messageText: string = '';

  constructor(
    private firestore: Firestore,
    private chatService: ChatService,
    private userService: UserService
  ) {
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
      this.loadMessages();
    });

    this.chatService.selectedUser$.subscribe(user => {
      this.selectedUserDisplayName = user;
      if (this.isDirectMessage) {
        this.loadMessages();
      }
    });
  }

  ngOnInit() {
    this.loadMessages();
  }

  async loadMessages() {
    try {
      this.currentUser = await this.chatService.getCurrentUser();
      console.log('Current user:', this.currentUser);

      this.chatService.isDirectMessage$.subscribe(async (isDirectMessage) => {
        console.log('Is direct message:', isDirectMessage);
        this.isDirectMessage = isDirectMessage;

        if (isDirectMessage) {
          // Direct Messages
          const selectedUserId = this.chatService.selectedUser;
          console.log('Loading DMs for selected user:', selectedUserId);
          
          if (selectedUserId && this.currentUser) {
            const messagesRef = collection(this.firestore, 'messages');
            
            // Query für beide Richtungen der Konversation
            const q = query(
              messagesRef,
              where('channelId', '==', null),
              orderBy('timestamp', 'asc'),
              where('recipientId', 'in', [selectedUserId, this.currentUser.uid]),
              where('userId', 'in', [selectedUserId, this.currentUser.uid])
            );
            
            if (this.messagesSubscription) {
              this.messagesSubscription.unsubscribe();
            }
            
            this.messagesSubscription = collectionData(q).pipe(
              map(messages => {
                console.log('Raw DM messages:', messages);
                return messages.filter(msg => 
                  (msg['userId'] === this.currentUser?.uid && msg['recipientId'] === selectedUserId) ||
                  (msg['userId'] === selectedUserId && msg['recipientId'] === this.currentUser?.uid)
                );
              })
            ).subscribe(messages => {
              console.log('Filtered DM messages:', messages);
              if (messages.length > 0) {
                this.messages = messages;
                this.groupMessagesByDate();
                this.chatService.setHasMessages(true);
              } else {
                this.messages = [];
                this.messageGroups = [];
                this.chatService.setHasMessages(false);
              }
            });
          }
        } else {
          // Channel Messages
          this.chatService.selectedChannel$.pipe(take(1)).subscribe(channelName => {
            if (channelName) {
              console.log('Loading channel messages for:', channelName);
              const messagesRef = collection(this.firestore, 'messages');
              const q = query(
                messagesRef,
                where('channelId', '==', channelName),
                orderBy('timestamp', 'asc')
              );
              
              if (this.messagesSubscription) {
                this.messagesSubscription.unsubscribe();
              }
              
              this.messagesSubscription = collectionData(q).subscribe(messages => {
                console.log('Channel messages:', messages);
                if (messages.length > 0) {
                  this.messages = messages;
                  this.groupMessagesByDate();
                  this.chatService.setHasMessages(true);
                } else {
                  this.messages = [];
                  this.messageGroups = [];
                  this.chatService.setHasMessages(false);
                }
              });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  groupMessagesByDate() {
    const groups = new Map<string, any[]>();
    
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
      messages
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

  async sendMessage() {
    if (this.messageText.trim() && this.currentUser) {
      try {
        const timestamp = serverTimestamp();
        const messageData = {
          text: this.messageText,
          userId: this.currentUser.uid,
          username: this.currentUser.displayName || 'Anonymous',
          timestamp: timestamp
        };

        if (this.isDirectMessage) {
          // Direct Message
          const selectedUserId = this.chatService.selectedUser$;
          if (selectedUserId) {
            await addDoc(collection(this.firestore, 'messages'), {
              ...messageData,
              recipientId: selectedUserId,
              channelId: null
            });
          }
        } else {
          // Channel Message
          const channelName = this.chatService.selectedChannel$;
          if (channelName) {
            await addDoc(collection(this.firestore, 'messages'), {
              ...messageData,
              channelId: channelName,
              recipientId: null
            });
          }
        }

        this.messageText = '';
        this.scrollToBottom();
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }

  scrollToBottom() {
    // Implement the logic to scroll to the bottom of the message container
  }
}
