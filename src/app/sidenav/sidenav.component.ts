import { Component, signal, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { ChatComponent } from '../chat/chat.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { MatDialog } from '@angular/material/dialog';
import { AddNewChannelComponent } from './add-new-channel/add-new-channel.component';
import { MatExpansionPanel } from '@angular/material/expansion';
import { Firestore, collection, addDoc, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { ChatService } from '../services/chat.service';
import { getAuth } from '@angular/fire/auth';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';

interface Channel {
  name: string;
  description?: string;
}

interface User {
  id: string;
  username: string;
  displayName?: string;
  uid?: string;
  avatar?: string;
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [
    MatSidenavModule, 
    MatButtonModule, 
    MatExpansionModule, 
    MatIconModule,
    CommonModule,
    MatListModule,
    ChatComponent,
    NavbarComponent,
    MatExpansionPanel
  ],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss'
})

export class SidenavComponent implements OnInit {
  isActive: boolean = false;
  readonly panelOpenState = signal(false);
  selectedChannel: string = '';
  selectedUser: string = '';
  isDirectMessage: boolean = false;
  channels: Channel[] = [];
  channels$: Observable<Channel[]>;
  users: User[] = [];
  users$: Observable<User[]>;
  currentUserId: string | null = null;

  constructor(
    private dialog: MatDialog,
    private firestore: Firestore,
    private chatService: ChatService,
    private auth: Auth,
    private userService: UserService,
    private router: Router
  ) {
    // Channels aus Firestore laden
    const channelsCollection = collection(this.firestore, 'channels');
    this.channels$ = collectionData(channelsCollection) as Observable<Channel[]>;
    
    // Users aus Firestore laden mit ID
    const usersCollection = collection(this.firestore, 'users');
    collectionData(usersCollection, { idField: 'id' }).subscribe(users => {
      this.users = users.map(user => ({
        ...user,
        avatar: user['avatar'] || null
      })) as User[];
    });
    

    // Neue Users Collection laden
    const usersCollectionNew = collection(this.firestore, 'users');
    this.users$ = collectionData(usersCollectionNew) as Observable<User[]>;
    
    // Subscribe to channels
    this.channels$.subscribe(channels => {
      if (channels && channels.length > 0) {
        this.channels = channels;
        // Wenn kein Channel ausgewählt ist, den ersten auswählen
        if (!this.selectedChannel) {
          this.selectChannel(channels[0].name);
        }
      }
    });

    // Subscribe to chat service changes
    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });
    
    this.chatService.selectedUser$.subscribe(user => {
      this.selectedUser = user || '';
    });
  }

  async ngOnInit() {
    // Initialer Load der Channels
    this.loadChannels();
    // Initialer Load der Users
    this.loadUsers();
    // Subscribe to chatService to keep track of selected states
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
    });

    this.chatService.selectedUser$.subscribe(async userId => {
      // Wenn eine userId vorhanden ist, hole den displayName
      if (userId) {
        const user = await this.userService.getUserById(userId);
        this.selectedUser = user?.displayName || user?.username || '';
      } else {
        this.selectedUser = '';
      }
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });

    // Direkt die Auth UID verwenden
    this.currentUserId = this.auth.currentUser?.uid || null;

    // Falls die ID sich ändert
    this.auth.onAuthStateChanged((user) => {
      this.currentUserId = user?.uid || null;
    });
  }


  loadChannels() {
    const channelsCollection = collection(this.firestore, 'channels');
    collectionData(channelsCollection).subscribe(channels => {
      this.channels = channels as Channel[];
    });
  }

  loadUsers() {
    const usersCollection = collection(this.firestore, 'users');
    collectionData(usersCollection, { idField: 'id' }).subscribe(users => {
      this.users = users.map(user => {
        const mappedUser = {
          id: user['id'],
          uid: user['uid'], // Wichtig: Wir brauchen beide IDs
          username: user['displayName'] || user['username'] || 'Unnamed User',
          displayName: user['displayName'],
          avatar: user['avatar'] || 'default-avatar.png'
        };
        return mappedUser;
      }) as User[];
    });

  }

  selectChannel(channelName: string) {
    this.selectedChannel = channelName;
    this.selectedUser = '';
    this.isDirectMessage = false;
    this.chatService.selectChannel(channelName);
    this.chatService.setNewChatMode(false);
  }

  selectUser(user: User) {
    const userIdentifier = user.displayName || user.username || '';
    this.selectedUser = userIdentifier;
    this.selectedChannel = '';
    this.isDirectMessage = true;
    this.chatService.selectUser(user.uid || '');
    this.chatService.setNewChatMode(false);
  }

  async openAddChannelDialog() {
    const dialogRef = this.dialog.open(AddNewChannelComponent, {
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.name) {
        try {
          const currentUser = this.auth.currentUser;
          console.log('Current User:', currentUser); // Debug log
          
          if (!currentUser) {
            console.error('Kein User eingeloggt');
            return;
          }

          const channelsCollection = collection(this.firestore, 'channels');
          const channelData = {
            name: result.name,
            description: result.description || '',
            createdAt: new Date(),
            createdByUserId: currentUser.uid  // Speichere die User-ID
          };
          
          console.log('Saving channel with data:', channelData); // Debug log
          
          await addDoc(channelsCollection, channelData);
          this.selectChannel(result.name);
        } catch (error) {
          console.error('Error adding channel:', error);
        }
      }
    });
  }

  isChannelActive(channelName: string): boolean {
    return this.selectedChannel === channelName && !this.isDirectMessage;
  }

  isUserActive(user: User): boolean {
    const userIdentifier = user.displayName || user.username || '';
    return this.selectedUser === userIdentifier && this.isDirectMessage;
  }

  startNewChat() {
    this.chatService.setNewChatMode(true);
  }
}
