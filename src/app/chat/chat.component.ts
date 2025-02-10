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
import { MemberListDialogComponent } from './member-list-dialog/member-list-dialog.component';
import { ActivatedRoute } from '@angular/router';


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
    MemberListDialogComponent
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
  isMemberListOpen = false;
  channelCreatedAt: Date | null = null;  // Neue Property
  isNewChat: boolean = false;
  recipientInput: string = '';
  showWelcomeMessage = true;
  filteredResults: any[] = [];
  showResults: boolean = false;

  constructor(
    private firestore: Firestore,
    public chatService: ChatService,
    private userService: UserService,
    private route: ActivatedRoute
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
        this.channelCreatedAt = channelData['createdAt']?.toDate() || null;  // Datum laden

        // Lade Channel-Mitglieder
        await this.loadChannelMembers();

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

  async loadChannelMembers() {
    if (this.currentChannelId) {
      try {
        console.log('Loading members for channel:', this.currentChannelId);

        const channelRef = doc(this.firestore, 'channels', this.currentChannelId);
        const channelSnap = await getDoc(channelRef);

        if (!channelSnap.exists()) {
          console.error('Channel document does not exist');
          return;
        }

        const channelData = channelSnap.data();
        // Prüfe beide möglichen Felder
        const creatorId = channelData['createdByUserId'] || channelData['createdBy'];
        console.log('Channel data:', channelData);
        console.log('Creator ID:', creatorId);

        const membersRef = collection(this.firestore, 'channelMembers');
        const q = query(membersRef, where('channelId', '==', this.currentChannelId));
        const querySnapshot = await getDocs(q);

        const memberPromises = querySnapshot.docs.map(async (memberDoc) => {
          const memberData = memberDoc.data();
          const userDoc = await getDoc(doc(this.firestore, 'users', memberData['userId']));
          const userData = userDoc.data();

          const isCreator = memberData['userId'] === creatorId;
          console.log(`Checking if member ${memberData['userId']} is creator:`, isCreator);

          const member = {
            uid: memberData['userId'],
            username: userData?.['username'] || 'Unbekannter Benutzer',
            email: userData?.['email'],
            avatar: userData?.['avatar'] || 'default-avatar.png',
            isCreator: isCreator,
            isOnline: userData?.['isOnline'] || false
          };
          console.log('Loaded member:', member);
          return member;
        });

        this.channelMembers = await Promise.all(memberPromises);
        console.log('All channel members loaded:', this.channelMembers);
      } catch (error) {
        console.error('Error loading channel members:', error);
      }
    }
  }

  async ngOnInit() {
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
      this.isNewChat = isNewChat;
      if (isNewChat) {
        this.showWelcomeMessage = false;
        this.selectedChannel = '';
        this.selectedUserDisplayName = '';
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
      const messagesRef = collection(this.firestore, 'messages');
      const currentUser = await this.chatService.getCurrentUser();


      // Hole zusätzliche User-Informationen aus der Datenbank
      const userDoc = await this.userService.getUserById(currentUser.uid);

      // Prüfe und füge User als Channel-Mitglied hinzu, falls noch nicht vorhanden
      if (!this.isDirectMessage && this.currentChannelId) {
        const channelMembersRef = collection(this.firestore, 'channelMembers');

        const q = query(channelMembersRef,
          where('channelId', '==', this.currentChannelId),
          where('userId', '==', currentUser.uid)
        );

        const memberSnapshot = await getDocs(q);

        if (memberSnapshot.empty) {
          await addDoc(channelMembersRef, {
            channelId: this.currentChannelId,
            userId: currentUser.uid,
            joinedAt: new Date()
          });

          // Aktualisiere die Mitgliederliste
          await this.loadChannelMembers();
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
    this.isMemberListOpen = true;
  }

  closeMemberList() {
    this.isMemberListOpen = false;
  }

  getFormattedCreationDate(): string {
    if (!this.channelCreatedAt) return '';

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
      // Formatierung auf dd.mm.yyyy ändern
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
        const q = query(
          channelsRef,
          where('name', '>=', input.substring(1)),
          where('name', '<=', input.substring(1) + '\uf8ff')
        );
        const querySnapshot = await getDocs(q);
        this.filteredResults = querySnapshot.docs.map(doc => ({
          type: 'channel',
          id: doc.id,
          name: doc.data()['name'],
          icon: 'tag'
        }));

      } else if (input.startsWith('@')) {
        // Suche nach Benutzern
        const usersRef = collection(this.firestore, 'users');
        const q = query(
          usersRef,
          where('username', '>=', input.substring(1)),
          where('username', '<=', input.substring(1) + '\uf8ff')
        );
        const querySnapshot = await getDocs(q);
        this.filteredResults = querySnapshot.docs
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
        const q = query(
          usersRef,
          where('email', '>=', input),
          where('email', '<=', input + '\uf8ff')
        );
        const querySnapshot = await getDocs(q);
        this.filteredResults = querySnapshot.docs
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

  selectResult(result: any) {
    if (result.type === 'channel') {
      this.chatService.selectChannel(result.name);
    } else if (result.type === 'user') {
      this.chatService.selectUser(result.id);
    }
    
    // Reset aller relevanten Zustände
    this.recipientInput = '';
    this.showResults = false;
    this.filteredResults = [];
    this.isNewChat = false;
    this.chatService.setNewChatMode(false);
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
}