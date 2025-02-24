import { Component, inject, HostListener } from '@angular/core';
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
  doc,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';
import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FooterComponent, NgClass, FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  animations: [
    trigger('fadeBackground', [
      state('visible', style({ opacity: 1, visibility: 'visible' })),
      state('hidden', style({ opacity: 0, visibility: 'hidden' })),
      transition('visible => hidden', [animate('1s ease-in-out')]),
    ]),

    trigger('logoAnimation', [
      state('start', style({ transform: 'translateX(100%)' })),
      state('end', style({ transform: 'translateX(0)' })),
      transition('start => end', [animate('0.7s ease-in-out')]),
    ]),

    trigger('logoContainerAnimation', [
      state(
        'start',
        style({
          scale: 2,
          position: 'absolute',
          top: '50%',
          left: '50%',
          color: '#fff',
          transform: 'translate(-50%, -50%)',
        })
      ),
      state(
        'mobileStart',
        style({
          scale: 1,
          position: 'absolute',
          top: '50%',
          left: '50%',
          color: '#fff',
          transform: 'translate(-50%, -50%)',
        })
      ),
      state(
        'end',
        style({
          scale: 1,
          position: 'absolute',
          top: '20px',
          left: '20px',
          transform: 'translate(0, 0)',
          color: '#000',
        })
      ),
      state(
        'mobileEnd',
        style({
          scale: 1,
          top: '20px',
          left: '50%',
          transform: 'translate(-50%, 0%)',
          color: '#000',
          position: 'absolute',
        })
      ),
      transition('start => end', [animate('1s ease-in-out')]),
      transition('mobileStart => mobileEnd', [animate('1s ease-in-out')]),
    ]),
  ],
})
export class LoginComponent {
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);

  constructor(private router: Router, private userService: UserService) {
    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth <= 1175;
    this.containerState = this.isMobile ? 'mobileStart' : 'start';
    console.log('Screen size checked:', this.isMobile ? 'mobile' : 'desktop');
  }

  bgState = 'visible';
  logoState = 'start';
  textTypingAnimation = 'start';
  containerState = 'start';
  textAnimationState = 'start';
  introPlayed: boolean = false;
  isMobile: boolean = false;

  ngOnInit() {
    this.checkScreenSize();
    this.introPlayed = sessionStorage.getItem('introPlayed') !== null;

    if (this.introPlayed) {
      this.setEndState();
    } else {
      this.playIntroAnimation();
    }
  }

  private setEndState() {
    this.logoState = 'end';
    this.bgState = 'hidden';
    this.containerState = this.isMobile ? 'mobileEnd' : 'end';
  }

  private playIntroAnimation() {
    this.logoState = 'start';
    this.containerState = this.isMobile ? 'mobileStart' : 'start';

    setTimeout(() => {
      this.logoState = 'end';
    }, 200);

    setTimeout(() => {
      this.containerState = this.isMobile ? 'mobileEnd' : 'end';
      this.textAnimationState = 'end';
    }, 1400);

    setTimeout(() => {
      this.setEndState();
      sessionStorage.setItem('introPlayed', 'true');
    }, 1400);
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
    // Prüfe die Bildschirmgröße direkt vor dem Login
    this.checkScreenSize();
    console.log('Login attempt, isMobile:', this.isMobile);

    this.userService
      .login(this.userEmail, this.userPassword)
      .then(async () => {
        await this.addUserToFrontEndTeam();

        if (this.isMobile) {
          console.log('Navigating to workspace (mobile)');
          await this.router.navigate(['/workspace']);
        } else {
          console.log('Checking channels for desktop navigation');
          const channelsRef = collection(this.firestore, 'channels');
          const querySnapshot = await getDocs(channelsRef);
          if (!querySnapshot.empty) {
            const firstChannel = querySnapshot.docs[0];
            console.log('Navigating to channel:', firstChannel.id);
            await this.router.navigate(['/workspace/channel', firstChannel.id]);
          } else {
            console.log('No channels found, navigating to workspace');
            await this.router.navigate(['/workspace']);
          }
        }
      })
      .catch((error) => {
        console.error('Login error:', error);
        if (error.code) {
          this.passwordNotExist = true;
        }
      });
  }

  private async addUserToFrontEndTeam() {
    try {
      const currentUser = await this.userService.getCurrentUser();
      if (!currentUser) return;

      const channelsRef = collection(this.firestore, 'channels');
      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const messagesRef = collection(this.firestore, 'messages');

      const channelQuery = query(
        channelsRef,
        where('name', '==', 'Front-End-Team')
      );
      const existingChannels = await getDocs(channelQuery);

      if (!existingChannels.empty) {
        const channelId = existingChannels.docs[0].id;

        const memberQuery = query(
          channelMembersRef,
          where('channelId', '==', channelId),
          where('userId', '==', currentUser.uid)
        );
        const memberSnapshot = await getDocs(memberQuery);

        if (memberSnapshot.empty) {
          const membership = {
            channelId: channelId,
            userId: currentUser.uid,
            joinedAt: new Date(),
          };
          await addDoc(channelMembersRef, membership);

          const joinMessage = {
            text: 'Hallo zusammen! Ich bin neu hier und freue mich auf die Zusammenarbeit!',
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            timestamp: new Date(),
            channelId: channelId,
            recipientId: null,
          };
          await addDoc(messagesRef, joinMessage);
        }
      }
    } catch (error) {
      console.error('Error adding user to Front-End-Team:', error);
    }
  }

  guestSucess() {
    this.checkScreenSize();
    console.log('Guest login attempt, isMobile:', this.isMobile);

    this.userService
      .login('gäste@login.login', 'gästelogin')
      .then(async () => {
        await this.initializeGuestChat();

        if (this.isMobile) {
          console.log('Navigating to workspace (mobile guest)');
          await this.router.navigate(['/workspace']);
        } else {
          console.log('Checking channels for desktop navigation (guest)');
          const channelsRef = collection(this.firestore, 'channels');
          const querySnapshot = await getDocs(channelsRef);
          if (!querySnapshot.empty) {
            const firstChannel = querySnapshot.docs[0];
            console.log('Navigating to channel:', firstChannel.id);
            await this.router.navigate(['/workspace/channel', firstChannel.id]);
          } else {
            console.log('No channels found, navigating to workspace');
            await this.router.navigate(['/workspace']);
          }
        }
      })
      .catch((error) => {
        console.error('Guest login error:', error);
        alert('Fehler beim Login: ' + error.message);
      });
  }

  private async initializeGuestChat() {
    try {
      console.log('Starting initializeGuestChat');
      const messagesRef = collection(this.firestore, 'messages');
      const channelsRef = collection(this.firestore, 'channels');
      const channelMembersRef = collection(this.firestore, 'channelMembers');

      const currentUser = await this.userService.getCurrentUser();
      if (!currentUser) {
        console.error('No user found');
        return;
      }
      console.log('Current user:', currentUser);

      const guestUserId = 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z1';
      const sofiasId = 'a4QeEY8CNEd6CZ2KwQZVCBhlJ2z0';
      const saschasId = 'NbMgkSxq3fULESFz01t7Sk7jDxw2';

      const channelQuery = query(
        channelsRef,
        where('name', '==', 'Front-End-Team')
      );
      const existingChannels = await getDocs(channelQuery);
      console.log(
        'Existing channels:',
        existingChannels.empty ? 'No channels found' : 'Channel exists'
      );

      let channelId;

      if (existingChannels.empty) {
        console.log('Creating new Front-End-Team channel');

        const newChannel = {
          name: 'Front-End-Team',
          description: 'Channel für Frontend-Entwicklung',
          createdBy: sofiasId,
          createdAt: new Date(),
        };

        try {
          const channelDoc = await addDoc(channelsRef, newChannel);
          channelId = channelDoc.id;
          console.log('Channel created with ID:', channelId);

          const sofiaMembership = {
            channelId: channelId,
            userId: sofiasId,
            joinedAt: new Date(),
          };
          await addDoc(channelMembersRef, sofiaMembership);
          console.log('Sofia added as member');

          const saschaMembership = {
            channelId: channelId,
            userId: saschasId,
            joinedAt: new Date(),
          };
          await addDoc(channelMembersRef, saschaMembership);
          console.log('Sascha added as member');

          const welcomeMessage = {
            text: 'Willkommen im Front-End-Team! Hier besprechen wir alle Themen rund um die Benutzeroberfläche.',
            userId: sofiasId,
            username: 'Sofia Weber',
            timestamp: new Date(),
            channelId: channelId,
            recipientId: null,
          };
          await addDoc(messagesRef, welcomeMessage);
          console.log('Welcome message added');

          const saschaMessage = {
            text: 'Danke für die Einladung! Ich freue mich auf die Zusammenarbeit.',
            userId: saschasId,
            username: 'Sascha Lenz',
            timestamp: new Date(),
            channelId: channelId,
            recipientId: null,
          };
          await addDoc(messagesRef, saschaMessage);
          console.log('Sascha message added');
        } catch (error) {
          console.error('Error during channel creation:', error);
          throw error;
        }
      } else {
        channelId = existingChannels.docs[0].id;
        console.log('Using existing channel with ID:', channelId);
      }

      const guestMemberQuery = query(
        channelMembersRef,
        where('channelId', '==', channelId),
        where('userId', '==', guestUserId)
      );
      const guestMemberSnapshot = await getDocs(guestMemberQuery);
      console.log('Guest is already member:', !guestMemberSnapshot.empty);

      if (guestMemberSnapshot.empty) {
        console.log('Adding guest as member');

        const guestMembership = {
          channelId: channelId,
          userId: guestUserId,
          joinedAt: new Date(),
        };
        await addDoc(channelMembersRef, guestMembership);

        const guestMessage = {
          text: 'Danke für die Einladung! Ich freue mich darauf, mehr über das Projekt zu erfahren.',
          userId: guestUserId,
          username: 'Gäste Login',
          timestamp: new Date(),
          channelId: channelId,
          recipientId: null,
        };
        await addDoc(messagesRef, guestMessage);
        console.log('Guest message added');
      }

      console.log('initializeGuestChat completed successfully');
    } catch (error) {
      console.error('Error in initializeGuestChat:', error);
      throw error;
    }
  }

  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);

      if (result.user) {
        const userDoc = doc(this.firestore, 'users', result.user.uid);
        const userSnapshot = await getDoc(userDoc);

        if (!userSnapshot.exists()) {
          const userData = {
            uid: result.user.uid,
            email: result.user.email,
            username: result.user.displayName,
            avatar: result.user.photoURL,
            createdAt: new Date(),
          };

          await setDoc(userDoc, userData);
          console.log('Neuer User in Firestore angelegt:', userData);
        } else {
          console.log('User existiert bereits:', userSnapshot.data());
        }

        await this.router.navigate(['/workspace']);
      }
    } catch (error) {
      console.error('Error during Google sign-in:', error);
    }
  }
}
