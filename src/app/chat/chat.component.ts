import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatService } from '../services/chat.service';
import { ChannelSettingsComponent } from './channel-settings/channel-settings.component';
import { FormsModule } from '@angular/forms';
import { Firestore } from '@angular/fire/firestore';
import { collection, query, where, getDocs, doc, getDoc, addDoc, setDoc } from '@firebase/firestore';
import { ProfileInfoComponent } from './profile-info/profile-info.component';
import { MessagesComponent } from './messages/messages.component';
import { UserService } from '../services/user.service';
import { AddMemberDialogComponent } from './add-member-dialog/add-member-dialog.component';

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
    MatTooltipModule,
    ChannelSettingsComponent,
    FormsModule,
    MessagesComponent,
    AddMemberDialogComponent
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})

export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContent') private chatContent!: ElementRef;
  private shouldScroll = false;
  isSettingsOpen = false;
  currentChannelId = '';
  channelName = '';
  channelDescription = '';
  createdBy = '';
  selectedChannel: string | null = null;
  selectedUserDisplayName: string = '';
  selectedUserAvatar: string | null = null;
  isDirectMessage = false;
  isProfileOpen = false;
  selectedUserEmail = '';
  isSelectedUserOnline = false;
  messageText: string = '';
  hasMessages: boolean = false;
  currentUserId: string | null = null;
  channelMembers: any[] = [];  // Array für Channel-Mitglieder
  isAddMemberDialogOpen = false;
  channelMemberIds: string[] = []; // Neue Property für Member IDs
  currentUser: any;
  isCurrentUser = false;

  constructor(
    private firestore: Firestore,
    public chatService: ChatService,
    private userService: UserService
  ) {
    // Aktuellen User ID speichern
    this.userService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
      }
    });

    // Channel Subscription
    this.chatService.selectedChannel$.subscribe(channelName => {
      if (channelName) {
        this.loadChannelDetails(channelName);
      }
    });

    // Direct Message Subscription
    this.chatService.selectedUser$.subscribe(async (userId) => {
      if (userId) {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('uid', '==', userId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          this.selectedUserDisplayName = userData['username'] || 'Unbekannt';
          this.selectedUserEmail = userData['email'] || '';
          this.selectedUserAvatar = userData['avatar'];
          console.log('Loaded DM user data:', userData);
          this.isCurrentUser = userId === this.currentUserId;
        }
      }
    });

    // Messages Status Subscription
    this.chatService.hasMessages$.subscribe(
      hasMessages => this.hasMessages = hasMessages
    );

    // Direct Message Status Subscription
    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
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
        
        this.currentChannelId = channelDoc.id;
        this.channelName = channelData['name'];
        this.channelDescription = channelData['description'] || '';
        
        // Lade Channel-Mitglieder
        await this.loadChannelMembers(channelDoc.id);
        
        if (channelData['createdByUserId']) {
          const userId = channelData['createdByUserId'];
          const user = await this.userService.getUserById(userId);
          this.createdBy = user?.username || user?.displayName || 'Unbekannt';
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Channel-Details:', error);
    }
  }

  async loadChannelMembers(channelId: string) {
    try {
      console.log('Loading members for channel:', channelId);
      const membersRef = collection(this.firestore, 'channelMembers');
      const q = query(membersRef, where('channelId', '==', channelId));
      const querySnapshot = await getDocs(q);
      
      const memberPromises = querySnapshot.docs.map(async (doc) => {
        const memberData = doc.data();
        const userId = memberData['userId'];
        const user = await this.userService.getUserById(userId);
        
        if (user) {
          return {
            uid: userId,
            username: user.username,
            avatar: user.avatar
          };
        }
        return null;
      });

      const members = await Promise.all(memberPromises);
      this.channelMembers = members.filter(member => member !== null);
      // Aktualisiere die Member IDs
      this.channelMemberIds = this.channelMembers.map(member => member.uid);
      console.log('Final channel members:', this.channelMembers);
    } catch (error) {
      console.error('Error loading channel members:', error);
    }
  }

  async ngOnInit() {
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });

    this.chatService.selectedUser$.subscribe(async (userId) => {
      if (userId) {
        const user = await this.userService.getUserById(userId);
        if (user) {
          this.selectedUserDisplayName = user.username;
        }
      }
    });

    this.chatService.hasMessages$.subscribe(
      hasMessages => this.hasMessages = hasMessages
    );

    // Füge existierende Nachrichtenautoren als Mitglieder hinzu
    await this.addExistingMessageAuthorsAsMembers();

    // Channel Subscription
    this.chatService.selectedChannel$.subscribe(async channelName => {
      if (channelName) {
        await this.loadChannelDetails(channelName);
        // Füge existierende Nachrichtenautoren als Mitglieder hinzu
        await this.addExistingMessageAuthorsAsMembers();
        // Lade die Channel-Mitglieder nach dem Hinzufügen
        if (this.currentChannelId) {
          await this.loadChannelMembers(this.currentChannelId);
        }
      }
    });
  }

  getPlaceholderText(): string {
    if (this.isDirectMessage) {
      return this.selectedUserDisplayName ? 
        `Nachricht an @${this.selectedUserDisplayName}` : 
        'Nachricht schreiben...';
    }
    return this.selectedChannel ? 
      `Nachricht an #${this.selectedChannel}` : 
      'Nachricht schreiben...';
  }

  getWelcomeText(): string {
    if (this.isDirectMessage) {
      return this.selectedUserDisplayName ? 
        `Dies ist der Beginn deiner Direktnachricht mit @${this.selectedUserDisplayName}` : 
        'Wähle einen Benutzer aus, um eine Direktnachricht zu beginnen';
    }
    return this.selectedChannel ? 
      `Willkommen im Channel #${this.selectedChannel}` : 
      'Wähle einen Channel aus, um die Unterhaltung zu beginnen';
  }

  async openSettings() {
    if (this.isDirectMessage) {
      const selectedUserId = this.chatService.selectedUser;
      if (selectedUserId) {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('uid', '==', selectedUserId));
        
        try {
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            this.selectedUserEmail = userData['email'];
            this.selectedUserAvatar = userData['avatar'];
          }
        } catch (error) {
          console.error('Fehler beim Laden der User-Daten:', error);
        }
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
    if (this.isDirectMessage && this.selectedUserDisplayName) {
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

    try {
      const messagesRef = collection(this.firestore, 'messages');
      const currentUser = await this.chatService.getCurrentUser();
      
      // Debug-Log für den aktuellen User
      console.log('Current user:', currentUser);

      // Hole zusätzliche User-Informationen aus der Datenbank
      const userDoc = await this.userService.getUserById(currentUser.uid);
      console.log('User doc:', userDoc);

      // Prüfe und füge User als Channel-Mitglied hinzu, falls noch nicht vorhanden
      if (!this.isDirectMessage && this.currentChannelId) {
        console.log('Checking membership for channel:', this.currentChannelId);
        const channelMembersRef = collection(this.firestore, 'channelMembers');
        
        const q = query(channelMembersRef, 
          where('channelId', '==', this.currentChannelId),
          where('userId', '==', currentUser.uid)
        );
        
        const memberSnapshot = await getDocs(q);
        console.log('Member snapshot empty?', memberSnapshot.empty);
        
        if (memberSnapshot.empty) {
          console.log('Adding user to channel members:', currentUser.uid);
          await addDoc(channelMembersRef, {
            channelId: this.currentChannelId,
            userId: currentUser.uid,
            joinedAt: new Date()
          });
          
          // Aktualisiere die Mitgliederliste
          await this.loadChannelMembers(this.currentChannelId);
        }
      }

      const messageData = {
        text: this.messageText.trim(),
        timestamp: new Date(),
        userId: currentUser.uid,
        username: userDoc?.username || 'Unbekannt',
        channelId: this.isDirectMessage ? null : this.selectedChannel,
        recipientId: this.isDirectMessage ? this.chatService.selectedUser : null
      };

      console.log('Sending message with data:', messageData);
      await addDoc(messagesRef, messageData);
      this.messageText = '';
      this.shouldScroll = true;
    } catch (error) {
      console.error('Error in sendMessage:', error);
    }
  }

  getUserDisplayName(user: any): string {
    if (user.uid === this.currentUser?.uid) {
      return `${user.username} (Du)`;
    }
    return user.username;
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const element = this.chatContent.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch (err) {
      console.error('Fehler beim Scrollen:', err);
    }
  }

  async addExistingMessageAuthorsAsMembers() {
    if (!this.currentChannelId) return;

    try {
      console.log('Adding existing message authors as members');
      const messagesRef = collection(this.firestore, 'messages');
      const q = query(messagesRef, where('channelId', '==', this.selectedChannel));
      const messageSnapshot = await getDocs(q);

      const channelMembersRef = collection(this.firestore, 'channelMembers');
      
      for (const messageDoc of messageSnapshot.docs) {
        const messageData = messageDoc.data();
        const userId = messageData['userId'];
        
        if (userId) {
          // Prüfe ob User bereits Mitglied ist
          const memberQuery = query(channelMembersRef, 
            where('channelId', '==', this.currentChannelId),
            where('userId', '==', userId)
          );
          const memberSnapshot = await getDocs(memberQuery);
          
          if (memberSnapshot.empty) {
            console.log('Adding existing message author as member:', userId);
            await addDoc(channelMembersRef, {
              channelId: this.currentChannelId,
              userId: userId,
              joinedAt: new Date()
            });
          }
        }
      }
      
      // Aktualisiere die Mitgliederliste
      await this.loadChannelMembers(this.currentChannelId);
    } catch (error) {
      console.error('Error adding existing message authors:', error);
    }
  }

  async onMemberAdded() {
    // Aktualisiere die Mitgliederliste
    await this.loadChannelMembers(this.currentChannelId);
  }

  async loadDirectMessageUser(userId: string) {
    // ... bestehender Code
    this.isCurrentUser = userId === this.currentUserId;
  }

  async openAddMemberDialog() {
    this.isAddMemberDialogOpen = true;
  }

  closeAddMemberDialog() {
    this.isAddMemberDialogOpen = false;
  }
}

