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
    trigger('moveAnimation', [
      state('center', style({ transform: 'translate(0, 0)' })),
      state(
        'moveToCorner',
        style({ transform: 'translate(-40vw, -40vh) scale(0.5)' })
      ),
    ]),
    trigger('logoFadeAnimation', [
      state('center', style({ opacity: 0, scale: 0.5 })), //start
      state('moveToCorner', style({ opacity: 1, scale: 1.5 })), //ende
      transition('center => moveToCorner', animate('2s ease')), //zeit dazwischen
    ]),
    trigger('nameFadeAnimation', [
      state('center', style({ opacity: 0 })),
      state(
        'moveToCorner',
        style({ opacity: 1, transform: 'translate(24px, 0)' })
      ),
      transition('center => moveToCorner', animate('1s ease-in-out')), // Delay of 1s
    ]),
  ],
})
export class LoginComponent {
  private firestore: Firestore = inject(Firestore);

  constructor(private router: Router, private userService: UserService) {}
  animationState = 'center';
  backgroundColor = 'blue';

  ngOnInit() {
    setTimeout(() => {
      this.animationState = 'moveToCorner';
    }, 60);
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
        this.router.navigate(['/sidenav']); // Erfolgreicher Login
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
        this.router.navigate(['/sidenav']);
      })
      .catch((error) => {
        console.error('Login fehlgeschlagen', error);
        alert('Fehler beim Login: ' + error.message);
      });
  }

  private async initializeGuestChat() {
    try {
      const messagesRef = collection(this.firestore, 'messages');
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

      // Channel-Nachrichten für "Front-End-Team"
      const channelMessages = [
        {
          text: 'Willkommen im Front-End-Team! Hier besprechen wir alle Themen rund um die Benutzeroberfläche.',
          userId: 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z1',
          username: 'Sofia Weber',
          timestamp: new Date(currentTime.getTime() - 30 * 60000),
          channelId: 'Front-End-Team',
          recipientId: null,
        },
        {
          text: 'Danke für die Einladung! Ich freue mich darauf, mehr über das Projekt zu erfahren.',
          userId: guestUserId,
          username: 'Gäste Login',
          timestamp: new Date(currentTime.getTime() - 25 * 60000),
          channelId: 'Front-End-Team',
          recipientId: null,
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
          recipientId: guestUserId,
        },
        {
          text: 'Ja, die sehen super aus! Besonders die neue Navigation gefällt mir sehr gut.',
          userId: guestUserId,
          username: 'Gäste Login',
          timestamp: new Date(currentTime.getTime() - 15 * 60000),
          channelId: null,
          recipientId: 'NbMgkSxq3fULESFz01t7Sk7jDxw2',
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
