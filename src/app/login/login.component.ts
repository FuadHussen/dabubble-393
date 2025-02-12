import { Component, inject } from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { Router } from '@angular/router';
import { FooterComponent } from '../shared/footer/footer.component';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  imports: [FooterComponent, NgClass, FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  animations: [
    trigger('fadeBackground', [
      state('visible', style({ opacity: 1, visibility: 'visible' })),
      state('hidden', style({ opacity: 0, visibility: 'hidden' })),
      transition('visible => hidden', [
        animate('1s ease-in-out')
      ])
    ]),
  
    trigger('logoAnimation', [
      state('start', style({ transform: 'translateX(200%)' })), // Start ganz rechts
      state('end', style({ transform: 'translateX(0)' })), // Endposition normal
      transition('start => end', [
        animate('1s ease-in-out')
      ])
    ]),
  
    trigger('textTypingAnimation', [
      transition(':enter', [
        style({ width: '0', overflow: 'hidden' }), // Start: Kein Text sichtbar
        animate('2s steps(10, end)', style({ width: '100%' })) // Schrittweises Tippen
      ])
    ]),
  
    trigger('logoContainerAnimation', [
      state('start', style({
        scale:1,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      })),
      state('end', style({
        scale:1,
        top: '20px', // Zielposition (anpassen!)
        left: '20px',
        transform: 'translate(0, 0)'
      })),
      transition('start => end', [
        animate('1s ease-in-out')
      ])
    ])
  ],
})
export class LoginComponent {
  private firestore: Firestore = inject(Firestore);

  constructor(private router: Router, private userService: UserService) {}
  bgState = 'visible';
  logoState = 'start';
  textTypingAnimation = 'start';
  containerState = 'start';
  ngOnInit() {
    setTimeout(() => {
      this.logoState = 'end'; // Logo-Bild bewegt sich rein
    }, 500);
  
    setTimeout(() => {
      this.textTypingAnimation = 'end'; // Logo-Name Schreibanimation startet erst jetzt
    }, 3000); // Verzögerung angepasst: erst nach der Logo-Animation starten
  
    setTimeout(() => {
      this.bgState = 'hidden'; // Hintergrund ausblenden
      this.containerState = 'end'; // Logo-Container bewegt sich an Zielposition
    }, 3000);
  }

  userEmail: string = '';
  userPassword: string = '';
  isFilled: boolean = false;
  emailNotExist: boolean = false;
  passwordNotExist: boolean = false;

  userNameSrc: string = '../../assets/img/person.png';
  userEmailSrc: string = '../../assets/img/mail.png';
  userPasswordSrc: string = '../../assets/img/lock.png';

  onFocus(field: string): void {
    if (field === 'userEmail' && !this.userEmail) {
      this.userEmailSrc = '../../assets/img/mail-active.png';
    } else if (field === 'userPassword' && !this.userPassword) {
      this.userPasswordSrc = '../../assets/img/lock-active.png';
    }
  }

  onBlur(field: string): void {
    if (field === 'userEmail' && !this.userEmail) {
      this.userEmailSrc = '../../assets/img/mail.png';
    } else if (field === 'userPassword' && !this.userPassword) {
      this.userPasswordSrc = '../../assets/img/lock.png';
    }
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'userEmail') {
      this.userEmail = value;
      this.userEmailSrc = value
        ? '../../assets/img/mail-active.png'
        : '../../assets/img/mail.png';
    } else if (field === 'userPassword') {
      this.userPassword = value;
      this.userPasswordSrc = value
        ? '../../assets/img/lock-active.png'
        : '../../assets/img/lock.png';
    }
    this.enableButton();
  }

  enableButton(): void {
    const emailPattern = /\S+@\S+\.\S+/;
    this.isFilled =
      emailPattern.test(this.userEmail) && this.userPassword.length >= 6;
  }

  navigateToSignUp() {
    this.router.navigate(['/signup']);
  }

  navigateToForgotPassword() {
    this.router.navigate(['/reset-password']);
  }

  loginSucess() {
    this.userService
      .login(this.userEmail, this.userPassword)
      .then(() => {
        this.router.navigate(['/workspace']); // Erfolgreicher Login
      })
      .catch((error) => {
        if (error.code) {
          this.passwordNotExist = true; // Fehlermeldung für daten
        }
      });
  }

  guestSucess() {
    this.userService
      .login('gäste@login.login', 'gästelogin')
      .then(async () => {
        await this.initializeGuestChat();
        this.router.navigate(['/workspace']);
      })
      .catch((error) => {
        console.error('Login fehlgeschlagen', error);
        alert('Fehler beim Login: ' + error.message);
      });
  }

  private async initializeGuestChat() {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const channelsRef = collection(this.firestore, 'channels');
      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const currentTime = new Date();

      // Hole zuerst die aktuelle User-ID des Gäste-Logins
      const currentUser = await this.userService.getCurrentUser();
      if (!currentUser) {
        console.error('No user found');
        return;
      }

      const guestUserId = currentUser.uid;

      // Prüfe ob bereits Nachrichten für den Gast existieren
      const existingMessagesQuery = query(
        messagesRef,
        where('userId', '==', guestUserId)
      );

      const existingMessages = await getDocs(existingMessagesQuery);

      // Wenn bereits Nachrichten existieren, nicht neu erstellen
      if (!existingMessages.empty) {
        console.log('Chat already initialized for guest user');
        return;
      }

      // Erstelle zuerst den Channel
      const channelDoc = await addDoc(channelsRef, {
        name: 'Front-End-Team',
        description: 'Channel für Frontend-Entwicklung',
        createdBy: 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z1', // Sofia ist die Erstellerin
        createdAt: new Date(currentTime.getTime() - 35 * 60000)
      });

      // Füge Channel-Mitglieder hinzu
      await addDoc(channelMembersRef, {
        channelId: channelDoc.id,
        userId: 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z1', // Sofia
        joinedAt: new Date(currentTime.getTime() - 35 * 60000)
      });

      await addDoc(channelMembersRef, {
        channelId: channelDoc.id,
        userId: guestUserId, // Gast
        joinedAt: new Date(currentTime.getTime() - 25 * 60000)
      });

      // Channel-Nachrichten für "Front-End-Team"
      const channelMessages = [
        {
          text: 'Willkommen im Front-End-Team! Hier besprechen wir alle Themen rund um die Benutzeroberfläche.',
          userId: 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z1',
          username: 'Sofia Weber',
          timestamp: new Date(currentTime.getTime() - 30 * 60000),
          channelId: channelDoc.id,
          recipientId: null
        },
        {
          text: 'Danke für die Einladung! Ich freue mich darauf, mehr über das Projekt zu erfahren.',
          userId: guestUserId,
          username: 'Gäste Login',
          timestamp: new Date(currentTime.getTime() - 25 * 60000),
          channelId: channelDoc.id,
          recipientId: null
        },
      ];

      // Direct Messages mit Sascha Lenz
      const dmMessagesSascha = [
        {
          text: 'Hi! Ich bin Sascha aus dem Design-Team. Hast du schon unsere neuen UI-Komponenten gesehen?',
          userId: 'NbMgkSxq3fULESFz01t7Sk7jDxw2',
          username: 'Sascha Lenz',
          timestamp: new Date(currentTime.getTime() - 20 * 60000),
          channelId: null,
          recipientId: guestUserId
        },
        {
          text: 'Ja, die sehen super aus! Besonders die neue Navigation gefällt mir sehr gut.',
          userId: guestUserId,
          username: 'Gäste Login',
          timestamp: new Date(currentTime.getTime() - 15 * 60000),
          channelId: null,
          recipientId: 'NbMgkSxq3fULESFz01t7Sk7jDxw2'
        },
      ];

      // Alle Nachrichten in Firestore speichern
      const allMessages = [...channelMessages, ...dmMessagesSascha];

      for (const message of allMessages) {
        await addDoc(messagesRef, message);
      }

      console.log('Chat initialized for guest user');
    } catch (error) {
      console.error('Error initializing guest chat:', error);
    }
  }
}
