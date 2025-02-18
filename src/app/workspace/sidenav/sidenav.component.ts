import { Component, signal, OnInit, ViewEncapsulation, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { ChatComponent } from '../../chat/chat.component';
import { NavbarComponent } from '../../navbar/navbar.component';
import { MatDialog } from '@angular/material/dialog';
import { AddNewChannelComponent } from './add-new-channel/add-new-channel.component';
import { MatExpansionPanel } from '@angular/material/expansion';
import { Firestore, collection, addDoc, collectionData, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { ChatService } from '../../services/chat.service';
import { Auth } from '@angular/fire/auth';
import { UserService } from '../../services/user.service';
import { NavigationEnd, Router } from '@angular/router';
import { HostListener } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { NgZone } from '@angular/core';
import { ThreadComponent } from '../../chat/thread/thread.component';

interface Channel {
  name: string;
  description?: string;
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
  uid?: string;
  avatar?: string;
  isOnline?: boolean;
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
    MatExpansionPanel,
    ThreadComponent
  ],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss',
  encapsulation: ViewEncapsulation.None
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
  threadMessage$: Observable<any>;
  isMobile: boolean = false;
  drawerOpened: boolean = true;
  showChat: boolean = false;
  @ViewChild('drawer') drawer: any;

  // Immer false für die Entwicklung
  showThread = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private dialog: MatDialog,
    private firestore: Firestore,
    private chatService: ChatService,
    private auth: Auth,
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.checkScreenSize();
    
    this.channels$ = collectionData(collection(this.firestore, 'channels')) as Observable<Channel[]>;
    this.users$ = collectionData(collection(this.firestore, 'users')) as Observable<User[]>;
    this.threadMessage$ = this.chatService.threadMessage$;
    
    // Users aus Firestore laden mit ID
    const usersCollection = collection(this.firestore, 'users');
    this.subscriptions.push(
      collectionData(usersCollection, { idField: 'id' }).subscribe(users => {
        setTimeout(() => {
          this.users = users.map(user => ({
            ...user,
            avatar: user['avatar'] || null
          })) as User[];
        });
      })
    );

    // Subscribe to channels
    this.subscriptions.push(
      this.channels$.subscribe(channels => {
        setTimeout(() => {
          if (channels && channels.length > 0) {
            this.channels = channels;
            if (!this.selectedChannel) {
              this.selectChannel(channels[0].name);
            }
          }
        });
      })
    );

    // Subscribe to chat service changes
    this.subscriptions.push(
      this.chatService.isDirectMessage$.subscribe(isDM => {
        setTimeout(() => {
          this.isDirectMessage = isDM;
        });
      })
    );
    
    this.subscriptions.push(
      this.chatService.selectedUser$.subscribe(user => {
        setTimeout(() => {
          this.selectedUser = user || '';
        });
      })
    );

    // Auf Route-Änderungen reagieren
    this.subscriptions.push(
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          setTimeout(() => {
            this.updateChatView();
          });
        }
      })
    );

    // Thread-Message Subscription
    this.subscriptions.push(
      this.threadMessage$.subscribe(message => {
        setTimeout(() => {
          this.showThread = !!message;
          this.cdr.detectChanges();
        });
      })
    );
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth <= 1175;
    if (this.isMobile) {
      this.drawerOpened = true;
      this.showChat = false;
    } else {
      this.drawerOpened = true;
      this.showChat = true;
    }
    console.log('Screen size checked - Mobile:', this.isMobile, 'Drawer:', this.drawerOpened, 'ShowChat:', this.showChat);
  }

  // Neue Methode zum Aktualisieren der Chat-Ansicht
  private async updateChatView() {
    const url = this.router.url;
    if (url.includes('/channel/') || url.includes('/dm/')) {
      if (this.isMobile) {
        this.showChat = true;
        this.drawerOpened = false;
      }
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.drawerOpened = true;
    });
  }

  ngOnInit() {
    this.checkScreenSize();
    this.loadChannels();
    this.loadUsers();

    // Nur in Desktop-Ansicht automatisch ersten Channel laden
    if (!this.isMobile) {
      this.subscriptions.push(
        this.channels$.subscribe(channels => {
          if (channels && channels.length > 0 && !this.selectedChannel) {
            this.selectChannel(channels[0].name);
          }
        })
      );
    }

    // Router-Events überwachen
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Bei Navigation zurück zum Workspace in mobiler Ansicht
        if (event.url === '/workspace' && this.isMobile) {
          this.drawerOpened = true;
          this.showChat = false;
        }
      }
    });

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

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Remove event listener
    window.removeEventListener('resize', () => {
      this.checkScreenSize();
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
          uid: user['uid'],
          username: user['displayName'] || user['username'] || 'Unnamed User',
          displayName: user['displayName'],
          avatar: user['avatar'],
          isOnline: user['isOnline'] || false
        };
        return mappedUser;
      }) as User[];
    });
  }

  async selectUser(user: any) {
    try {
      console.log('Selecting user:', user);
      
      // Erst die Services aktualisieren
      await this.chatService.setIsDirectMessage(true);
      await this.chatService.selectUser(user.uid);
      
      // Dann UI-Status aktualisieren
      this.selectedUser = user.displayName || user.username;
      this.selectedChannel = '';
      this.isDirectMessage = true;
      
      if (this.isMobile) {
        console.log('Mobile: Setting drawer and chat state');
        this.drawerOpened = false;
        this.showChat = true;
      }
      
      // Navigation als letztes
      await this.router.navigate(['workspace', 'dm', user.uid]);
      
      // Force change detection
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error selecting user:', error);
    }
  }

  async selectChannel(channelName: string) {
    try {
      console.log('Selecting channel:', channelName, 'isMobile:', this.isMobile);
      
      // Wenn mobile, dann früh returnen
      if (this.isMobile) {
        console.log('Mobile view detected, preventing automatic channel selection');
        return;
      }
      
      const channelsCollection = collection(this.firestore, 'channels');
      const q = query(channelsCollection, where('name', '==', channelName));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const channelDoc = querySnapshot.docs[0];
        const channelId = channelDoc.id;

        this.ngZone.run(async () => {
          this.selectedChannel = channelName;
          this.selectedUser = '';
          this.isDirectMessage = false;

          // Desktop-Ansicht
          this.drawerOpened = true;
          this.showChat = true;
          
          await this.chatService.setIsDirectMessage(false);
          await this.chatService.selectChannel(channelName);
          this.chatService.setCurrentChannelId(channelId);
          
          await this.router.navigate(['/workspace/channel', channelId]);
          
          this.cdr.detectChanges();
        });
      }
    } catch (error) {
      console.error('Error selecting channel:', error);
    }
  }

  // Neue Methode für manuelle Channel-Auswahl
  async manualChannelSelect(channelName: string) {
    try {
      console.log('Manual channel selection:', channelName, 'isMobile:', this.isMobile);
      
      const channelsCollection = collection(this.firestore, 'channels');
      const q = query(channelsCollection, where('name', '==', channelName));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const channelDoc = querySnapshot.docs[0];
        const channelId = channelDoc.id;

        this.ngZone.run(async () => {
          this.selectedChannel = channelName;
          this.selectedUser = '';
          this.isDirectMessage = false;

          if (this.isMobile) {
            this.drawerOpened = false;
            this.showChat = true;
          }

          await this.chatService.setIsDirectMessage(false);
          await this.chatService.selectChannel(channelName);
          this.chatService.setCurrentChannelId(channelId);
          
          await this.router.navigate(['/workspace/channel', channelId]);
          
          this.cdr.detectChanges();
        });
      }
    } catch (error) {
      console.error('Error in manual channel selection:', error);
    }
  }

  async openAddChannelDialog() {
    const dialogRef = this.dialog.open(AddNewChannelComponent, {
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.name) {
        try {
          const currentUser = this.auth.currentUser;
          
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

  closeThread() {
    this.chatService.setThreadMessage(null);
  }

  // Optional: Methode zum Laden der Channel-Details
  async getChannelDetails(channelId: string) {
    try {
      const channelDocRef = doc(this.firestore, 'channels', channelId);
      const channelSnap = await getDoc(channelDocRef);
      
      if (channelSnap.exists()) {
        return channelSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting channel details:', error);
      return null;
    }
  }

  // Methode für den Back-Button
  onBackClicked() {
    if (this.isMobile) {
      this.drawerOpened = true;
      this.showChat = false;
      this.router.navigate(['/workspace']);
    }
  }
}