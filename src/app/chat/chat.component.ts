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
import { AvatarService } from '../services/avatar.service';
import { ChatMessageHandler } from './chat-message.handler';
import { ChatUIHandler } from './chat-ui.handler';
import { ChatSubscriptionHandler } from './chat-subscription.handler';
import { ChatChannelHandler } from './chat-channel.handler';

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
  // UI State
  isSettingsOpen = false;
  isProfileOpen = false;
  isAddMemberDialogOpen = false;
  showWelcomeMessage = true;
  showResults = false;
  showUserMentions = false;
  showEmojiPicker = false;
  showMemberList = false;
  showChat = false;
  threadVisible = false;

  // Chat State
  currentChannelId = '';
  channelName = '';
  channelDescription = '';
  createdBy = '';
  selectedChannel: string | null = null;
  selectedUserDisplayName = '';
  selectedUserAvatar: string | null = null;
  isDirectMessage = false;
  messageText = '';
  hasMessages = false;
  isNewChat = false;
  channelCreatedAt: Date | null = null;

  // User Data
  currentUserId: string | null = null;
  selectedUserEmail = '';
  isSelectedUserOnline = false;
  channelMembers: any[] = [];
  channelMemberIds: string[] = [];
  isCurrentUser = false;

  // Search and Mentions
  recipientInput = '';
  filteredResults: any[] = [];
  mentionResults: any[] = [];
  selectedMentions: string[] = [];

  // Component Properties
  @Input() isMobile = false;
  @Output() backClicked = new EventEmitter<void>();
  customTitle = 'Devspace';
  customImage = 'assets/img/devspace-logo.png';
  threadMessage$: Observable<Message | null>;

  // Emoji List
  emojis = ['😀', '😂', '😊', '😍', '🥰', '😎', '😴', '🤔', '😅', '😭', 
            '😤', '😡', '🥺', '😳', '🤯', '🤮', '🥳', '😇', '🤪', '🤓', 
            '👍', '👎', '👋', '🙌', '👏', '🤝', '🙏', '💪', '🫶', '❤️', 
            '🔥', '💯', '✨', '🎉', '👻', '🤖', '💩', '🦄'];

  constructor(
    private firestore: Firestore,
    public chatService: ChatService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private audioService: AudioService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private avatarService: AvatarService,
    private messageHandler: ChatMessageHandler,
    private uiHandler: ChatUIHandler,
    private subscriptionHandler: ChatSubscriptionHandler,
    private channelHandler: ChatChannelHandler
  ) {
    this.checkScreenSize();
    this.threadMessage$ = this.chatService.threadMessage$;
  }

  ngOnInit() {
    this.subscriptionHandler.initUserSubscriptions(this);
    this.subscriptionHandler.initRouteSubscriptions(this, this.route);
  }

  ngOnDestroy() {
    this.subscriptionHandler.dispose();
  }

  ngAfterViewInit() {
    // Könnte leer bleiben oder für AfterViewInit-spezifische Aufgaben verwendet werden
  }

  // Event Handlers
  async sendMessage(event?: KeyboardEvent) {
    if (event && (event.key !== 'Enter' || event.shiftKey)) return;
    if (event) event.preventDefault();

    const success = await this.messageHandler.sendMessage(
      this.messageText,
      this.selectedMentions,
      this.isDirectMessage,
      this.selectedChannel
    );

    if (success) {
      this.messageText = '';
      this.selectedMentions = [];
      this.mentionResults = [];
    }
  }

  async onAtButtonClick() {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart;
    this.messageText = this.messageText.slice(0, cursorPos) + '@' + this.messageText.slice(cursorPos);
    
    const searchResults = await this.messageHandler.searchUsers('', this.currentUserId!, this.messageText);
    this.mentionResults = searchResults;
    this.showUserMentions = true;
  }

  async onMessageInput(event: any) {
    const textarea = event.target as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart;
    const textUpToCursor = this.messageText.substring(0, cursorPos);
    const lastAtSymbol = textUpToCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const searchTerm = textUpToCursor.substring(lastAtSymbol + 1);
      if (searchTerm !== '') {
        const results = await this.messageHandler.searchUsers(
          searchTerm, 
          this.currentUserId!, 
          this.messageText
        );
        this.mentionResults = results;
        this.showUserMentions = true;
      }
    } else {
      this.showUserMentions = false;
    }
  }

  // UI Methods delegated to UIHandler
  getAvatarSrc(avatar: string | null): string {
    return this.uiHandler.getAvatarSrc(avatar);
  }

  toggleEmojiPicker(event: Event) {
    event.stopPropagation();
    this.showEmojiPicker = this.uiHandler.toggleEmojiPicker(this.showEmojiPicker);
  }

  addEmoji(emoji: string) {
    this.messageText = this.uiHandler.addEmoji(this.messageText, emoji);
    this.showEmojiPicker = false;
  }

  insertMention(user: any) {
    const result = this.uiHandler.insertMention(this.messageText, user, this.selectedMentions);
    this.messageText = result.messageText;
    this.selectedMentions = result.selectedMentions;
    this.showUserMentions = false;
    this.mentionResults = [];
  }

  // Text Formatting Methods
  getPlaceholderText(): string {
    return this.messageHandler.getPlaceholderText(
      this.isDirectMessage,
      this.selectedUserDisplayName,
      this.selectedChannel
    );
  }

  getWelcomeText(): string {
    return this.messageHandler.getWelcomeText(
      this.isDirectMessage,
      this.selectedUserDisplayName,
      this.selectedChannel
    );
  }

  getFormattedCreationDate(): string {
    return ''; // Implementiere dies in ChatChannelHandler falls nötig
  }

  @HostListener('window:resize')
  private checkScreenSize() {
    this.isMobile = this.uiHandler.checkScreenSize();
  }

  // Minimal required methods to keep component working
  onBackClick() {
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

  // Channel Settings & Profile methods
  openSettings() {
    this.isSettingsOpen = true;
  }

  onCloseSettings() {
    this.isSettingsOpen = false;
  }

  closeProfile() {
    this.isProfileOpen = false;
  }

  // Member management methods
  openMemberList() {
    this.showMemberList = true;
  }

  onMemberListClose() {
    this.showMemberList = false;
  }

  openAddMemberDialog() {
    this.isAddMemberDialogOpen = true;
  }

  closeAddMemberDialog() {
    this.isAddMemberDialogOpen = false;
  }

  async onMemberAdded() {
    // Nach dem Hinzufügen eines Mitglieds die Mitgliederliste aktualisieren
    if (this.currentChannelId) {
      this.channelMembers = await this.channelHandler.loadChannelMembers(this.currentChannelId);
    }
  }

  // New chat recipient methods
  onRecipientInput() {
    // Implementierung für die Empfängersuche
    // Diese Funktion muss später noch implementiert werden
    this.showResults = this.recipientInput.length > 0;
    // Hier müsste die Logik für die Filterung der Ergebnisse implementiert werden
  }

  selectResult(result: any) {
    // Ergebnis-Auswahl für neue Chats
    // Diese Funktion muss später noch implementiert werden
    this.recipientInput = result.name;
    this.showResults = false;
    
    // Je nach Typ (Kanal oder Benutzer) entsprechend handeln
    if (result.type === 'channel') {
      this.chatService.selectChannel(result.name);
      this.chatService.setIsDirectMessage(false);
    } else if (result.type === 'user') {
      this.chatService.selectUser(result.id);
      this.chatService.setIsDirectMessage(true);
    }
  }
}