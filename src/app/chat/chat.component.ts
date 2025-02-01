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
import { collection, query, where, getDocs, doc, getDoc } from '@firebase/firestore';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    TextFieldModule,
    ChannelSettingsComponent,
    FormsModule
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
  selectedUser: string | null = null;
  isDirectMessage = false;

  constructor(
    private firestore: Firestore,
    private chatService: ChatService
  ) {
    this.chatService.selectedChannel$.subscribe(channelName => {
      if (channelName) {
        this.loadChannelDetails(channelName);
      }
    });
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
      this.chatService.getCurrentChannelId().subscribe(id => {
        this.currentChannelId = id;
      });
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });

    this.chatService.selectedUser$.subscribe(user => {
      this.selectedUser = user;
    });
  }

  getPlaceholderText(): string {
    return this.isDirectMessage 
      ? `Nachricht an @${this.selectedUser}`
      : `Nachricht an #${this.selectedChannel}`;
  }

  openSettings() {
    this.isSettingsOpen = true;
  }

  onCloseSettings() {
    this.isSettingsOpen = false;
  }

  saveSettings(settings: {name: string, description: string}) {
    console.log('Neue Einstellungen:', settings);
    this.isSettingsOpen = false;
  }
}

