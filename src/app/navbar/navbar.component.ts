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
  threadId?: string;  // Für Thread-Nachrichten
}

interface Channel {
  name: string;
  description?: string;
}

interface User {
  username: string;
  email?: string;
  avatar?: string;
  uid: string;
}

interface Message {
  id: string;
  text: string;
  timestamp: any;
  userId: string;
  username: string;
  channelId: string | null;
  recipientId?: string;
  threadId?: string;  // Für Thread-Nachrichten
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

    // Neue Subscription für Avatar-Änderungen
    this.userService.avatar$.subscribe(avatar => {
      if (avatar) {
        this.userAvatar = avatar;
      }
    });

    // Suchfunktion
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(async (searchTerm) => {
      if (searchTerm) {
        // Mindestlänge nur für normale Suche, nicht für @ und #
        if (searchTerm.startsWith('@') || searchTerm.startsWith('#')) {
          await this.search(searchTerm);
          this.showResults = true;
        } else if (searchTerm.length >= 2) {
          await this.search(searchTerm);
          this.showResults = true;
        } else {
          this.searchResults = [];
          this.showResults = false;
        }
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

    // Prüfe auf spezielle Suchoperatoren
    if (term.startsWith('@')) {
      // Nur nach Benutzern suchen
      await this.searchUsers(term.slice(1));
      return;
    } else if (term.startsWith('#')) {
      // Nur nach Channels suchen
      await this.searchChannels(term.slice(1));
      return;
    }

    // Normale Suche für alle Typen
    await Promise.all([
      this.searchChannels(lowercaseTerm),
      this.searchUsers(lowercaseTerm),
      this.searchMessages(lowercaseTerm)
    ]);
  }

  // Neue Methode für Channel-Suche
  private async searchChannels(term: string) {
    const lowercaseTerm = term.toLowerCase();
    const processedChannels = new Set();
    const currentUser = this.auth.currentUser;

    if (!currentUser) return;

    // Firestore Channels durchsuchen
    const channelsRef = collection(this.firestore, 'channels');
    const channelsSnapshot = await getDocs(channelsRef);

    for (const doc of channelsSnapshot.docs) {
      const channel = doc.data() as Channel;
      const channelName = channel.name.toLowerCase();

      if (channelName.includes(lowercaseTerm)) {
        // Prüfe ob der User Zugriff auf diesen Channel hat
        const hasAccess = await this.chatService.hasChannelAccess(doc.id);

        if (hasAccess && !processedChannels.has(channelName)) {
          processedChannels.add(channelName);
          const searchResult = {
            type: 'channel',
            title: channel.name,
            subtitle: channel.description || 'Keine Beschreibung',
            id: doc.id  // Wichtig: Verwende die Firestore Document ID
          };
          this.searchResults.push(searchResult);
        }
      }
    }
  }

  // Neue Methode für User-Suche
  private async searchUsers(term: string) {
    const lowercaseTerm = term.toLowerCase();
    const processedUsers = new Set(); // Verhindert Duplikate

    // Firestore Users durchsuchen
    const usersRef = collection(this.firestore, 'users');
    const usersQuery = query(usersRef);
    const usersSnapshot = await getDocs(usersQuery);

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const username = userData['username']?.toLowerCase() || '';

      if (username.includes(lowercaseTerm) && !processedUsers.has(username)) {
        processedUsers.add(username);
        this.searchResults.push({
          type: 'user',
          title: userData['username'],
          subtitle: userData['email'] || '',
          avatar: userData['avatar'],
          id: doc.id
        });
      }
    });
  }

  // Bestehende searchMessages Methode aktualisieren
  private async searchMessages(term: string) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    // Zuerst alle Channel-IDs und Namen abrufen
    const channelsRef = collection(this.firestore, 'channels');
    const channelsSnapshot = await getDocs(channelsRef);
    const channelMap = new Map();

    // Channel-Map erstellen
    channelsSnapshot.docs.forEach(doc => {
      const channelData = doc.data();
      // Speichere sowohl die ID als auch den Namen als Schlüssel
      channelMap.set(channelData['name'], { id: doc.id, name: channelData['name'] });
    });

    const messagesRef = collection(this.firestore, 'messages');
    const messagesQuery = query(messagesRef);
    const messagesSnapshot = await getDocs(messagesQuery);
    const processedMessages = new Set();

    // Nachrichten sortieren
    const messages = messagesSnapshot.docs
      .map(doc => ({
        ...doc.data() as Message,
        id: doc.id
      }))
      .sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);

    for (const message of messages) {
      // Ändern des Schlüssels, um Text und Username zu berücksichtigen
      const messageKey = `${message.text}-${message.username}`;
      if (processedMessages.has(messageKey)) continue;

      if (message.text?.toLowerCase().includes(term.toLowerCase()) ||
          message.username?.toLowerCase().includes(term.toLowerCase())) {

        let source = '';
        let shouldAdd = false;
        let actualChannelId = '';

        if (message.channelId) {
          // Finde die korrekte Channel-ID
          const channelInfo = channelMap.get(message.channelId);
          if (channelInfo) {
            actualChannelId = channelInfo.id;
            source = `# ${channelInfo.name}`;
            shouldAdd = true;

            // Thread-Nachrichten verarbeiten
            if (message.threadId) {
              const threadDoc = await getDocs(
                query(collection(this.firestore, 'messages'),
                      where('__name__', '==', message.threadId))
              );

              if (!threadDoc.empty) {
                source = `${source} (Thread)`;
              }
            }
          }
        } else if (message.recipientId) {
          // Für Direktnachrichten
          if (message.userId === currentUser.uid || message.recipientId === currentUser.uid) {
            const recipient = await this.userService.getUserById(
              message.userId === currentUser.uid ? message.recipientId : message.userId
            );
            if (recipient) {
              source = `@ ${recipient.username}`;
              shouldAdd = true;
            }
          }
        }

        if (shouldAdd) {
          processedMessages.add(messageKey);
          const searchResult = {
            type: 'message',
            title: message.username || 'Unbekannt',
            subtitle: message.text,
            id: message.id,
            source: source,
            channelId: actualChannelId,
            threadId: message.threadId
          };
          this.searchResults.push(searchResult);
        }
      }
    }
  }

  selectResult(result: SearchResult) {
    switch (result.type) {
      case 'channel':

        this.chatService.selectChannel(result.id).then(() => {
          this.router.navigate(['/workspace/channel', result.id]);
        });
        break;

      case 'user':
        this.chatService.startDirectMessage(result.id).then(() => {
          this.router.navigate(['/workspace/dm', result.id]);
        });
        break;

      case 'message':
        if (result.threadId && result.channelId) {
          // Zuerst den Channel auswählen
          this.chatService.selectChannel(result.channelId).then(() => {
            // Dann zum Channel navigieren
            this.router.navigate(['/workspace/channel', result.channelId]).then(() => {
              // Warten bis die Navigation abgeschlossen ist
              setTimeout(() => {
                // Thread öffnen
                this.chatService.openThread(result.threadId!).then(() => {
                  // Zur Nachricht scrollen
                  setTimeout(() => {
                    this.chatService.triggerScrollToMessage(result.id);
                  }, 500);
                });
              }, 100);
            });
          });
        } else if (result.channelId) {
          this.chatService.selectChannel(result.channelId).then(() => {
            this.router.navigate(['/workspace/channel', result.channelId]).then(() => {
              setTimeout(() => {
                this.chatService.triggerScrollToMessage(result.id);
              }, 500);
            });
          });
        } else {
          const userQuery = query(
            collection(this.firestore, 'users'),
            where('username', '==', result.title)
          );
          getDocs(userQuery).then(userSnapshot => {
            if (!userSnapshot.empty) {
              const userData = userSnapshot.docs[0].data();
              const userId = userData['uid'];
              if (userId) {
                this.chatService.startDirectMessage(userId).then(() => {
                  this.router.navigate(['/workspace/dm', userId]);
                  setTimeout(() => {
                    this.chatService.triggerScrollToMessage(result.id);
                  }, 500);
                });
              }
            }
          });
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
    if (!avatar) {
      return '';
    }

    if (this.avatarService.isGoogleAvatar(avatar)) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }

    return 'assets/img/avatars/' + avatar;
  }
}
