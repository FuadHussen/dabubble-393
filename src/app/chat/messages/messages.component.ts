import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, addDoc, query, where, orderBy, onSnapshot } from '@angular/fire/firestore';
import { ChatService } from '../../services/chat.service';

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
  messages: Message[] = [];
  selectedChannel: string = '';
  isDirectMessage: boolean = false;
  selectedUser: string = '';
  hasMessages: boolean = false;

  constructor(
    private firestore: Firestore,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
      if (!this.isDirectMessage) {
        this.loadMessages();
      }
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
      this.loadMessages();
    });

    this.chatService.selectedUser$.subscribe(user => {
      this.selectedUser = user;
      if (this.isDirectMessage) {
        this.loadMessages();
      }
    });

    this.loadMessages();
  }

  private loadMessages() {
    const messagesRef = collection(this.firestore, 'messages');
    let q;

    if (this.isDirectMessage) {
      q = query(
        messagesRef,
        where('recipientId', '==', this.selectedUser),
        where('channelId', '==', null)
      );
    } else {
      q = query(
        messagesRef,
        where('channelId', '==', this.selectedChannel),
        where('recipientId', '==', null)
      );
    }

    onSnapshot(q, (snapshot) => {
      this.messages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data['timestamp']?.toDate()
        } as Message;
      });
      this.hasMessages = this.messages.length > 0;
      this.chatService.setHasMessages(this.hasMessages);
    });
  }
}
