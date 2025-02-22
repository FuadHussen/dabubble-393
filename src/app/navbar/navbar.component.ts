import { Component, ViewChild, ElementRef, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import { UserProfileSettingsComponent } from './user-profile-settings/user-profile-settings.component';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { collection, query, where, getDocs } from '@firebase/firestore';
import { Firestore } from '@angular/fire/firestore';
import { ChatService } from '../services/chat.service';
import { Auth } from '@angular/fire/auth';
import { AvatarService } from '../services/avatar.service';
interface SearchResult {
  type: 'channel' | 'user' | 'message';
  title: string;
  subtitle?: string;
  avatar?: string;
  id: string;
  source?: string;
  channelId?: string;
}

interface Channel {
  name: string;
  description?: string;
}

interface User {
  username: string;
  email?: string;
  avatar?: string;
}

interface Message {
  id: string;
  text: string;
  timestamp: any;
  userId: string;
  username: string;
  channelId: string | null;
  recipientId?: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    FormsModule,
    ReactiveFormsModule,
    UserProfileSettingsComponent
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})

export class NavbarComponent {
  @ViewChild('searchContainer') searchContainer!: ElementRef;
  
  searchControl = new FormControl('');
  searchResults: any[] = [];
  showResults: boolean = false;
  showProfileSettings = false;
  userName: string = '';
  userEmail: string = '';
  userAvatar: string | null = null;
  isMobile: boolean = false;
  @Input() customMode: boolean = false;
  @Input() customTitle: string = '';
  @Input() customImage: string = '';

  constructor(
    private auth: Auth,
    private router: Router,
    private firestore: Firestore,
    private chatService: ChatService,
    private userService: UserService,
    private avatarService: AvatarService
  ) {
    // Subscribe to user changes
    this.userService.currentUser$.subscribe(async user => {
      if (user) {
        // Direkt aus der users Collection laden
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          this.userName = userData['username'] || 'Unbekannt';
          this.userEmail = userData['email'] || '';
          this.userAvatar = userData['avatar'];
        }
      }
    });

    // Neue Subscription für Username-Änderungen
    this.userService.username$.subscribe(username => {
      if (username) {
        this.userName = username;
      }
    });

    // Suchfunktion
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(async (searchTerm) => {
      if (searchTerm && searchTerm.length >= 2) {
        await this.search(searchTerm);
        this.showResults = true;
      } else {
        this.searchResults = [];
        this.showResults = false;
      }
    });
  }

  ngOnInit() {
    // Initial user data load
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('uid', '==', currentUser.uid));
      getDocs(q).then(querySnapshot => {
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          this.userName = userData['username'];
          this.userEmail = userData['email'];
          this.userAvatar = userData['avatar'];
        }
      });
    }
    this.isMobile = window.innerWidth <= 1100;
  }

  openProfileSettings() {
    this.showProfileSettings = true;
  }

  closeProfileSettings() {
    this.showProfileSettings = false;
  }

  logout() {
    this.userService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }

  async search(term: string) {
    this.searchResults = [];
    const lowercaseTerm = term.toLowerCase();

    // Channels durchsuchen
    const channelsRef = collection(this.firestore, 'channels');
    const channelsQuery = query(channelsRef, where('name', '>=', lowercaseTerm));
    const channelsSnapshot = await getDocs(channelsQuery);
    
    // Hartcodierte Channel für Gäste-Login hinzufügen
    const guestChannel = {
      name: 'Front-End-Team',
      description: 'Frontend Entwicklung und UI/UX Design'
    };
    
    if (guestChannel.name.toLowerCase().includes(lowercaseTerm)) {
      this.searchResults.push({
        type: 'channel',
        title: guestChannel.name,
        subtitle: guestChannel.description,
        id: 'Front-End-Team'  // Exakt wie im Login Component
      });
    }

    channelsSnapshot.forEach(doc => {
      const channel = doc.data() as Channel;
      if (channel.name.toLowerCase().includes(lowercaseTerm)) {
        this.searchResults.push({
          type: 'channel',
          title: channel.name,
          subtitle: channel.description || 'Keine Beschreibung',
          id: doc.id
        });
      }
    });

    // Users durchsuchen
    const usersRef = collection(this.firestore, 'users');
    const usersQuery = query(usersRef, where('username', '>=', lowercaseTerm));
    const usersSnapshot = await getDocs(usersQuery);
    
    // Hartcodierte User für Gäste-Login hinzufügen
    const guestUsers = [
      {
        username: 'Sofia Weber',
        email: 'sofia@example.com',
        avatar: 'sofia-mueller-avatar.png',
        uid: 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z0'  // Korrekte UID aus Firebase
      },
      {
        username: 'Sascha Lenz',
        email: 'sascha@example.com',
        avatar: 'frederik-beck-avatar.png',
        uid: 'NbMgkSxq3fULESFz01t7Sk7jDxw2'  // Korrekte UID aus Firebase
      },
      {
        username: 'Gäste Login',
        email: 'gäste@login.login',
        id: 'guest-user'
      }
    ];

    guestUsers.forEach(user => {
      if (user.username.toLowerCase().includes(lowercaseTerm) || 
          user.email.toLowerCase().includes(lowercaseTerm)) {
        this.searchResults.push({
          type: 'user',
          title: user.username,
          subtitle: user.email,
          avatar: user.avatar,
          id: user.uid  // Hier die korrekte UID verwenden
        });
      }
    });

    usersSnapshot.forEach(doc => {
      const user = doc.data() as User;
      if (user.username?.toLowerCase().includes(lowercaseTerm)) {
        this.searchResults.push({
          type: 'user',
          title: user.username,
          subtitle: user.email || '',
          avatar: user.avatar,
          id: doc.id
        });
      }
    });

    // Messages durchsuchen
    const messagesRef = collection(this.firestore, 'messages');
    const messagesQuery = query(messagesRef, where('text', '>=', lowercaseTerm));
    const messagesSnapshot = await getDocs(messagesQuery);
    
    // Hartcodierte Nachrichten für Gäste-Login hinzufügen
    const guestMessages = [
      {
        text: 'Willkommen im Front-End-Team! Hier besprechen wir alle Themen rund um die Benutzeroberfläche.',
        username: 'Sofia Weber',
        channelId: 'Front-End-Team',
        id: 'guest-message-1',
        source: '# Front-End-Team'
      },
      {
        text: 'Hi! Ich bin Sascha aus dem Design-Team. Hast du schon unsere neuen UI-Komponenten gesehen?',
        username: 'Sascha Lenz',
        id: 'guest-message-2',
        source: '@ Sascha Lenz'
      },
      {
        text: 'Danke für die Einladung! Ich freue mich darauf, mehr über das Projekt zu erfahren.',
        username: 'Gäste Login',
        channelId: 'Front-End-Team',
        id: 'guest-message-3'
      },
      {
        text: 'Ja, die sehen super aus! Besonders die neue Navigation gefällt mir sehr gut.',
        username: 'Gäste Login',
        id: 'guest-message-4'
      }
    ];

    guestMessages.forEach(message => {
      if (message.text.toLowerCase().includes(lowercaseTerm) || 
          message.username.toLowerCase().includes(lowercaseTerm)) {
        this.searchResults.push({
          type: 'message',
          title: message.username,
          subtitle: message.text,
          id: message.id,
          source: message.source,
          channelId: message.channelId
        });
      }
    });

    messagesSnapshot.forEach(async (doc) => {
      const message = doc.data() as Message;
      let source = '';
      if (message.channelId) {
        source = `# ${message.channelId}`;
      } else if (message.recipientId) {
        const recipient = await this.userService.getUserById(message.recipientId);
        source = `@ ${recipient?.username || 'Unbekannt'}`;
      }

      if (message.text.toLowerCase().includes(lowercaseTerm)) {
        this.searchResults.push({
          type: 'message',
          title: message.username,
          subtitle: message.text,
          id: doc.id,
          source: source,
          channelId: message.channelId
        });
      }
    });
  }

  async selectResult(result: SearchResult) {

    switch (result.type) {
      case 'channel':
        this.chatService.selectChannel(result.title);
        break;
      case 'user':
        const userQuery = query(
          collection(this.firestore, 'users'),
          where('username', '==', result.title)
        );
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          this.chatService.selectUser(userData['uid']);
        } else {
          console.error('User not found:', result.title);
        }

        break;
      case 'message':
        if (result.channelId) {
          // Für Nachrichten in Channels
          this.chatService.selectChannel(result.channelId);
        } else {
          // Für Direktnachrichten
          const userQuery = query(
            collection(this.firestore, 'users'),
            where('username', '==', result.title)
          );
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            this.chatService.selectUser(userData['uid']);
          }
        }
        break;
    }
    this.closeSearch();
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent) {
    // Prüfen ob der Klick außerhalb des Such-Containers war
    if (this.searchContainer && !this.searchContainer.nativeElement.contains(event.target)) {
      this.closeSearch();
    }
  }

  closeSearch() {
    this.searchControl.setValue('');
    this.searchResults = [];
    this.showResults = false;
  }

  getAvatarSrc(avatar: string | null): string {
    if (!avatar) return '';
    
    if (this.avatarService.isGoogleAvatar(avatar)) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }
    
    return 'assets/img/avatars/' + avatar;
  }
}
