import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TextFieldModule } from '@angular/cdk/text-field';
import { ChatService } from '../services/chat.service';
import { ChannelSettingsComponent } from './channel-settings/channel-settings.component';
import { FormsModule } from '@angular/forms';
import { Firestore } from '@angular/fire/firestore';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from '@firebase/firestore';
import { ProfileInfoComponent } from './profile-info/profile-info.component';
import { MessagesComponent } from './messages/messages.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    ProfileInfoComponent,
    MatCardModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    TextFieldModule,
    ChannelSettingsComponent,
    FormsModule,
    MessagesComponent
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})

export class ChatComponent implements OnInit {
  isSettingsOpen = false;
  currentChannelId = '';
  channelName = '';
  channelDescription = '';
  createdBy = '';
  selectedChannel: string | null = null;
  selectedUser: string = '';
  isDirectMessage = false;
  isProfileOpen = false;
  selectedUserEmail = '';
  isSelectedUserOnline = false;
  messageText: string = '';
  hasMessages: boolean = false;

  constructor(
    private firestore: Firestore,
    private chatService: ChatService
  ) {
    this.chatService.selectedChannel$.subscribe(channelName => {
      if (channelName) {
        this.loadChannelDetails(channelName);
      }
    });

    // Subscribe to hasMessages updates
    this.chatService.hasMessages$.subscribe(
      hasMessages => this.hasMessages = hasMessages
    );
  }

  async loadChannelDetails(channelName: string) {
    try {
      const channelsRef = collection(this.firestore, 'channels');
      const q = query(channelsRef, where('name', '==', channelName));
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const channelDoc = querySnapshot.docs[0];
        const channelData = channelDoc.data();
        
        console.log('Channel Data:', channelData);
        
        this.currentChannelId = channelDoc.id;
        this.channelName = channelData['name'];
        this.channelDescription = channelData['description'] || '';
        
        // Hole den Benutzernamen aus der users Collection
        if (channelData['createdByUserId']) {
          const userId = channelData['createdByUserId'];
          console.log('User ID gefunden:', userId);
          
          // Direkter Zugriff auf das User-Dokument mit der ID
          const userRef = doc(this.firestore, 'users', userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log('User Data:', userData);
            this.createdBy = userData['username'] || 'Unbekannt';
          } else {
            this.createdBy = 'Benutzer nicht gefunden';
            console.log('Kein Benutzer mit dieser ID gefunden');
          }
        } else {
          console.log('Keine User ID im Channel gefunden');
          this.createdBy = 'Kein Ersteller zugewiesen';
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Channel-Details:', error);
      this.createdBy = 'Fehler beim Laden';
    }
  }

  ngOnInit() {
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });

    this.chatService.selectedUser$.subscribe(user => {
      this.selectedUser = user;
    });

    this.chatService.hasMessages$.subscribe(
      hasMessages => this.hasMessages = hasMessages
    );
  }

  getPlaceholderText(): string {
    return this.isDirectMessage 
      ? `Nachricht an @${this.selectedUser}`
      : `Nachricht an #${this.selectedChannel}`;
  }

  async openSettings() {
    if (this.isDirectMessage) {
      // Hole die User-Daten wenn es eine DM ist
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('username', '==', this.selectedUser));
      
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          this.selectedUserEmail = userData['email'];
        }
      } catch (error) {
        console.error('Fehler beim Laden der User-Daten:', error);
      }
      
      this.isProfileOpen = true;
    } else {
      this.isSettingsOpen = true;
    }
  }

  closeProfile() {
    this.isProfileOpen = false;
  }

  onCloseSettings() {
    this.isSettingsOpen = false;
  }

  saveSettings(settings: {name: string, description: string}) {
    console.log('Neue Einstellungen:', settings);
    this.isSettingsOpen = false;
  }

  openProfile() {
    if (this.isDirectMessage && this.selectedUser) {
      this.isProfileOpen = true;
    }
  }

  async sendMessage(event?: KeyboardEvent) {
    if (event && (event.key !== 'Enter' || event.shiftKey)) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    if (!this.messageText.trim()) return;

    const messagesRef = collection(this.firestore, 'messages');
    const currentUser = await this.chatService.getCurrentUser();

    const messageData = {
      text: this.messageText.trim(),
      timestamp: new Date(),
      userId: currentUser.uid,
      username: currentUser.username,
      channelId: this.isDirectMessage ? null : this.selectedChannel,
      recipientId: this.isDirectMessage ? this.selectedUser : null
    };

    try {
      await addDoc(messagesRef, messageData);
      this.messageText = '';
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
}

