import { Component, OnInit, AfterViewInit, HostListener, ChangeDetectorRef, Input, Output, EventEmitter, NgZone, OnDestroy } from '@angular/core';
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
import { MemberListDialogComponent } from './member-list-dialog/member-list-dialog.component';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable } from 'rxjs';
import { AudioService } from '../services/audio.service';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { ThreadComponent } from './thread/thread.component';
import { Message } from '../models/message.model';
import { NavbarComponent } from '../navbar/navbar.component';

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
    AddMemberDialogComponent,
    MemberListDialogComponent,
    ThreadComponent,
    NavbarComponent
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  animations: [
    trigger('chatSlide', [
      state('chat', style({
        transform: 'translateX(0)'
      })),
      state('thread', style({
        transform: 'translateX(-100%)'
      })),
      transition('chat <=> thread', [
        animate('300ms ease-in-out')
      ])
    ]),
    trigger('threadSlide', [
      state('visible', style({
        transform: 'translateX(0)'
      })),
      state('hidden', style({
        transform: 'translateX(100%)'
      })),
      transition('visible <=> hidden', [
        animate('300ms ease-in-out')
      ])
    ])
  ]
})

export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {
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
  isMemberListOpen = false;
  channelCreatedAt: Date | null = null;  // Neue Property
  isNewChat: boolean = false;
  recipientInput: string = '';
  showWelcomeMessage = true;
  filteredResults: any[] = [];
  showResults: boolean = false;
  showUserMentions: boolean = false;
  mentionResults: any[] = [];
  cursorPosition: number = 0;
  selectedMentions: string[] = [];
  showEmojiPicker = false;
  @Input() isMobile: boolean = false;
  @Output() backClicked = new EventEmitter<void>();
  showChat: boolean = false;
  private subscriptions: Subscription[] = [];
  threadVisible: boolean = false;
  threadMessage$: Observable<Message | null>;
  customTitle: string = 'Devspace';
  customImage: string = 'assets/img/devspace-logo.png';
  showMemberList = false;  // Property zum Steuern der Sichtbarkeit

  // Emoji-Array als Property definieren
  emojis: string[] = [
    '😀', '😂', '😊', '😍', '🥰', '😎', '😴', '🤔', 
    '😅', '😭', '😤', '😡', '🥺', '😳', '🤯', '🤮', 
    '🥳', '😇', '🤪', '🤓', '👍', '👎', '👋', '🙌', 
    '👏', '🤝', '🙏', '💪', '🫶', '❤️', '🔥', '💯', 
    '✨', '🎉', '👻', '🤖', '💩', '🦄'
  ];

  constructor(
    private firestore: Firestore,
    public chatService: ChatService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private audioService: AudioService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
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

    this.checkScreenSize();
    this.threadMessage$ = this.chatService.threadMessage$;

    this.chatService.currentChannelId$.subscribe(channelId => {
      if (channelId) {
        this.currentChannelId = channelId;
        this.loadChannelData(); // Lade die Channel-Daten neu
      }
    });

    // Subscription für ausgewählten User
    this.chatService.selectedUserData$.subscribe(userData => {
      if (userData) {
        this.selectedUserDisplayName = userData.username || userData.displayName || '';
        this.selectedUserAvatar = userData.avatar;
        this.isDirectMessage = true;
        this.selectedChannel = null;
        this.showWelcomeMessage = false;
      }
    });

    // Subscription für Channel-Auswahl
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
      if (channel) {
        this.isDirectMessage = false;
        this.selectedUserDisplayName = '';
        this.selectedUserAvatar = null;
      }
    });

    // Subscription für DM/Channel Status
    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
      if (!isDM) {
        this.selectedUserDisplayName = '';
        this.selectedUserAvatar = null;
      }
    });
  }

  ngOnInit() {
    this.subscriptions.push(
      this.chatService.messages$.subscribe(messages => {
        // Handle messages
      })
    );
    
    // Route params subscription
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        this.ngZone.run(() => {
          if (params['userId'] || params['channelId']) {
            this.showChat = true;
            setTimeout(() => {
              if (params['userId']) {
                this.chatService.setIsDirectMessage(true);
                this.chatService.selectUser(params['userId']);
              } else if (params['channelId']) {
                this.chatService.setIsDirectMessage(false);
                this.chatService.selectChannel(params['channelId']);
              }
            });
          }
        });
      })
    );

    // Chat service subscriptions
    this.subscriptions.push(
      this.chatService.selectedChannel$.subscribe(channel => {
        this.ngZone.run(() => {
          if (channel) {
            this.showChat = true;
            setTimeout(() => {
              this.loadChannelDetails(channel);
            });
          }
        });
      })
    );

    this.route.queryParams.subscribe(params => {
      this.isNewChat = params['mode'] === 'new';
      if (this.isNewChat) {
        this.showWelcomeMessage = false;
      }
    });

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

    this.chatService.isNewChatMode$.subscribe(isNewChat => {
      console.log('CHAT: NewChat mode changed:', isNewChat);
      this.isNewChat = isNewChat;
      if (this.isMobile) {
        this.showChat = true;
      }
    });

    this.chatService.hasMessages$.subscribe(
      hasMessages => this.hasMessages = hasMessages
    );

    // Listen to route params
    this.route.params.subscribe(params => {
      if (params['channelId']) {
        this.chatService.selectChannel(params['channelId']);
      } else if (params['userId']) {
        this.chatService.selectUser(params['userId']);
      }
    });

    // Füge existierende Nachrichtenautoren als Mitglieder hinzu
    this.addExistingMessageAuthorsAsMembers();

    // Channel Subscription
    this.chatService.selectedChannel$.subscribe(async channelName => {
      if (channelName) {
        await this.loadChannelDetails(channelName);
        // Füge existierende Nachrichtenautoren als Mitglieder hinzu
        await this.addExistingMessageAuthorsAsMembers();
        // Lade die Channel-Mitglieder nach dem Hinzufügen
        if (this.currentChannelId) {
          await this.loadChannelMembers();
        }
      }
    });

    this.chatService.isNewChatMode$.subscribe(isNewChat => {
      this.isNewChat = isNewChat;
      if (isNewChat) {
        this.showWelcomeMessage = false;
        this.selectedChannel = '';
        this.selectedUserDisplayName = '';
      }
    });

    // Verbesserte Subscriptions
    this.subscriptions.push(
      this.chatService.selectedChannel$.subscribe(async channel => {
        if (channel) {
          await this.loadChannelDetails(channel);
        }
      }),

      this.chatService.isDirectMessage$.subscribe(isDM => {
        this.isDirectMessage = isDM;
      }),

      this.chatService.selectedUser$.subscribe(async userId => {
        if (userId) {
          const user = await this.userService.getUserById(userId);
          if (user) {
            this.selectedUserDisplayName = user.username;
            this.selectedUserAvatar = user.avatar;
          }
        }
      })
    );

    // Subscription für NewChat-Modus
    this.chatService.isNewChatMode$.subscribe(isNewChat => {
      this.isNewChat = isNewChat;
      if (isNewChat) {
        this.showChat = true; // Zeige Chat-Komponente wenn NewChat aktiv ist
      }
    });

    // Subscription für selectedUser
    this.chatService.selectedUser$.subscribe(userId => {
      console.log('CHAT: Selected user changed:', userId);
      if (userId && this.isMobile) {
        this.showChat = true;
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth <= 1100;
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.ngZone.run(() => {
      this.checkScreenSize();
    });
  }

  async loadChannelDetails(channelName: string) {
    this.ngZone.run(async () => {
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
          
          await this.loadChannelMembers();
        }
      } catch (error) {
        console.error('Error loading channel details:', error);
      }
    });
  }

  async loadChannelMembers() {
    try {
      if (!this.currentChannelId) return;

      // Hole zuerst die Channel-Informationen um den Creator zu identifizieren
      const channelDoc = await getDoc(doc(this.firestore, 'channels', this.currentChannelId));
      const channelData = channelDoc.data();
      const creatorId = channelData?.['createdBy'];

      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const q = query(channelMembersRef, where('channelId', '==', this.currentChannelId));
      const memberSnapshot = await getDocs(q);
      
      this.channelMemberIds = memberSnapshot.docs.map(doc => doc.data()['userId']);

      // Dann die vollständigen Benutzerdaten laden
      const members = [];
      for (const memberId of this.channelMemberIds) {
        const userData = await this.userService.getUserById(memberId);
        if (userData) {
          members.push({
            ...userData,
            isCreator: memberId === creatorId // Hier setzen wir die isCreator Property
          });
        }
      }
      this.channelMembers = members;
    } catch (error) {
      console.error('Error loading channel members:', error);
    }
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

  saveSettings(settings: { name: string, description: string }) {
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
      const currentUser = await this.chatService.getCurrentUser();
      const userDoc = await this.userService.getUserById(currentUser.uid);

      const messageData = {
        text: this.messageText.trim(),
        userId: currentUser.uid,
        username: userDoc?.username || 'Unbekannt',
        channelId: this.isDirectMessage ? null : this.selectedChannel,
        recipientId: this.isDirectMessage ? this.chatService.selectedUser : null,
        mentions: this.selectedMentions
      };

      const success = await this.chatService.sendMessage(messageData);
      
      if (success) {
        this.messageText = '';
        this.selectedMentions = [];
        this.mentionResults = [];
      }
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

  async addExistingMessageAuthorsAsMembers() {
    if (!this.currentChannelId) return;

    try {
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
            await addDoc(channelMembersRef, {
              channelId: this.currentChannelId,
              userId: userId,
              joinedAt: new Date()
            });
          }
        }
      }

      // Aktualisiere die Mitgliederliste
      await this.loadChannelMembers();
    } catch (error) {
    }
  }

  async onMemberAdded() {
    await this.loadChannelMembers();
  }

  async loadDirectMessageUser(userId: string) {
    this.isCurrentUser = userId === this.currentUserId;
  }

  async openAddMemberDialog() {
    this.isAddMemberDialogOpen = true;
  }

  closeAddMemberDialog() {
    this.isAddMemberDialogOpen = false;
  }

  openMemberList() {
    this.showMemberList = true;
  }

  closeMemberList() {
    this.showMemberList = false;
  }

  onMemberListClose() {
    this.showMemberList = false;
  }

  getFormattedCreationDate(): string {
    if (!this.channelCreatedAt) {
      return '';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const creationDate = new Date(this.channelCreatedAt);
    const creationDay = new Date(
      creationDate.getFullYear(),
      creationDate.getMonth(),
      creationDate.getDate()
    );

    if (creationDay.getTime() === today.getTime()) {
      return 'heute';
    } else if (creationDay.getTime() === yesterday.getTime()) {
      return 'gestern';
    } else {
      const day = creationDate.getDate().toString().padStart(2, '0');
      const month = (creationDate.getMonth() + 1).toString().padStart(2, '0');
      const year = creationDate.getFullYear().toString();
      return `${day}.${month}.${year}`;
    }
  }

  async onRecipientInput() {
    const input = this.recipientInput.trim();
    this.showResults = input.length > 0;

    if (!input || input.length < 2) {
      this.filteredResults = [];
      return;
    }

    try {
      if (input.startsWith('#')) {
        // Suche nach Channels
        const channelsRef = collection(this.firestore, 'channels');
        const querySnapshot = await getDocs(channelsRef);
        this.filteredResults = querySnapshot.docs
          .filter(doc => {
            const channelName = doc.data()['name'].toLowerCase();
            const searchTerm = input.substring(1).toLowerCase();
            return channelName.includes(searchTerm);
          })
          .map(doc => ({
            type: 'channel',
            id: doc.id,
            name: doc.data()['name'],
            icon: 'tag'
          }));

      } else if (input.startsWith('@')) {
        // Suche nach Benutzern
        const usersRef = collection(this.firestore, 'users');
        const querySnapshot = await getDocs(usersRef);
        this.filteredResults = querySnapshot.docs
          .filter(doc => {
            const username = (doc.data()['username'] || '').toLowerCase();
            const searchTerm = input.substring(1).toLowerCase();
            return username.includes(searchTerm);
          })
          .map(doc => ({
            type: 'user',
            id: doc.id,
            name: doc.data()['username'],
            email: doc.data()['email'],
            avatar: doc.data()['avatar'],
            icon: 'person'
          }))
          .filter(user => user.id !== this.currentUserId);

      } else {
        // Suche nach E-Mail (mit oder ohne @)
        const usersRef = collection(this.firestore, 'users');
        const querySnapshot = await getDocs(usersRef);
        this.filteredResults = querySnapshot.docs
          .filter(doc => {
            const email = (doc.data()['email'] || '').toLowerCase();
            const username = (doc.data()['username'] || '').toLowerCase();
            const searchTerm = input.toLowerCase();
            return email.includes(searchTerm) || username.includes(searchTerm);
          })
          .map(doc => ({
            type: 'user',
            id: doc.id,
            name: doc.data()['username'],
            email: doc.data()['email'],
            avatar: doc.data()['avatar'],
            icon: 'mail'
          }))
          .filter(user => user.id !== this.currentUserId);
      }
    } catch (error) {
      console.error('Error searching for recipients:', error);
      this.filteredResults = [];
    }
  }

  async selectResult(result: any) {
    console.log('CHAT: selectResult called with:', result);
    
    if (result.type === 'user') {
      // Erst die Navigation und User-Selektion
      await this.router.navigate(['/workspace'], { 
        queryParams: { 
          type: 'dm',
          userId: result.id 
        }
      });
      
      this.chatService.setSelectedUser(result.id);
      this.chatService.setIsDirectMessage(true);
      
      // Dann erst den NewChat-Modus deaktivieren
      this.chatService.setNewChatMode(false);
      this.isNewChat = false;
      
      // Reset der Eingabefelder
      this.recipientInput = '';
      this.showResults = false;
      this.filteredResults = [];
    } else if (result.type === 'channel') {
      // ... Channel-Logik bleibt gleich ...
    }
  }

  // Diese Methode aufrufen, wenn ein Channel ausgewählt wird
  selectChannel(channel: string) {
    this.chatService.setNewChatMode(false); // Zurücksetzen des NewChat-Modus
    // ... restlicher existierender Code für Channel-Auswahl
  }

  // Diese Methode aufrufen, wenn eine Direct Message ausgewählt wird
  selectDirectMessage(user: any) {
    this.chatService.setNewChatMode(false); // Zurücksetzen des NewChat-Modus
    // ... restlicher existierender Code für DM-Auswahl
  }

  async onAtButtonClick() {
    // Füge @ am aktuellen Cursor ein
    const cursorPos = (document.querySelector('textarea') as HTMLTextAreaElement).selectionStart;
    const textBefore = this.messageText.substring(0, cursorPos);
    const textAfter = this.messageText.substring(cursorPos);
    this.messageText = textBefore + '@' + textAfter;
    
    // Zeige Benutzervorschläge
    await this.searchUsers('');
    this.showUserMentions = true;
  }

  async searchUsers(searchTerm: string) {
    try {
      const usersRef = collection(this.firestore, 'users');
      let q;
      
      if (searchTerm) {
        q = query(
          usersRef,
          where('username', '>=', searchTerm),
          where('username', '<=', searchTerm + '\uf8ff')
        );
      } else {
        q = query(usersRef);
      }

      const querySnapshot = await getDocs(q);
      
      // Extrahiere alle bereits erwähnten Benutzer aus dem aktuellen Text
      const currentMentions = this.messageText.match(/@(\w+\s\w+)/g) || [];
      const mentionedUsernames = currentMentions.map(mention => 
        mention.substring(1).trim() // Entferne das @-Symbol und Leerzeichen
      );


      // Filtere die Ergebnisse
      this.mentionResults = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          username: doc.data()['username'],
          avatar: doc.data()['avatar']
        }))
        .filter(user => {
          const isCurrentUser = user.id === this.currentUserId;
          const isAlreadyMentioned = mentionedUsernames.some(mention => 
            mention === user.username // Exakter Vergleich des Benutzernamens
          );
          
          
          return !isCurrentUser && !isAlreadyMentioned;
        });

    } catch (error) {
      console.error('Error searching users:', error);
      this.mentionResults = [];
    }
  }

  insertMention(user: any) {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart;
    const textBeforeAt = this.messageText.substring(0, this.messageText.lastIndexOf('@', cursorPos));
    const textAfter = this.messageText.substring(cursorPos);
    
    const mention = `@${user.username} `;
    this.messageText = textBeforeAt + mention + textAfter;
    
    const newCursorPos = textBeforeAt.length + mention.length;
    
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      this.searchUsers(''); // Aktualisiere die Liste
    });
    
    this.showUserMentions = false;
  }

  onMessageInput(event: any) {
    const textarea = event.target as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart;
    const textUpToCursor = this.messageText.substring(0, cursorPos);
    const lastAtSymbol = textUpToCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const searchTerm = textUpToCursor.substring(lastAtSymbol + 1);
      if (searchTerm !== '') {
        this.searchUsers(searchTerm);
        this.showUserMentions = true;
      }
    } else {
      this.showUserMentions = false;
    }
  }

  ngAfterViewInit() {
  }

  toggleEmojiPicker(event: Event) {
    event.stopPropagation(); // Verhindert Bubbling
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string) {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart || 0;
    const textBefore = this.messageText.substring(0, cursorPos);
    const textAfter = this.messageText.substring(cursorPos);
    
    this.messageText = textBefore + emoji + textAfter;
    
    // Setze Cursor nach dem Emoji
    const newCursorPos = cursorPos + emoji.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
    
    this.showEmojiPicker = false;
  }

  // Schließe Emoji-Picker wenn außerhalb geklickt wird
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const emojiPicker = document.querySelector('.emoji-picker');
    const emojiButton = document.querySelector('button[matPrefix]');
    
    if (emojiPicker && emojiButton) {
      const clickedInside = emojiPicker.contains(event.target as Node) || 
                          emojiButton.contains(event.target as Node);
      if (!clickedInside) {
        this.showEmojiPicker = false;
      }
    }
  }

  onBackClick() {
    console.log('CHAT: Back button clicked');
    this.showChat = false;
    this.isNewChat = false;
    this.backClicked.emit();
  }

  openThread(message: Message) {
    this.threadVisible = true;
    this.chatService.setThreadMessage(message);
  }

  closeThread() {
    this.threadVisible = false;
    this.chatService.setThreadMessage(null);
  }

  async loadChannelData() {
    try {
      if (!this.currentChannelId) return;
      
      const channelRef = doc(this.firestore, 'channels', this.currentChannelId);
      const channelSnap = await getDoc(channelRef);
      
      if (channelSnap.exists()) {
        const channelData = channelSnap.data();
        this.channelCreatedAt = channelData['createdAt']?.toDate() || null;
        this.channelName = channelData['name'] || '';
        this.channelDescription = channelData['description'] || '';
      }
    } catch (error) {
      console.error('Error loading channel data:', error);
    }
  }
}