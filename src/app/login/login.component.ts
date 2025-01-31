import { Component } from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { Router } from '@angular/router';
import { FooterComponent } from '../shared/footer/footer.component';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-login',
  imports: [FooterComponent, NgClass,FormsModule],
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
    this.isFilled = this.userEmail.trim() !== '' && this.userPassword.trim() !== '';
  }


  navigateToSignUp() {
    this.router.navigate(['/signup']); 
  }

  navigateToForgotPassword() {
    this.router.navigate(['/reset-password']);
  }

  loginSucess() {
    this.userService.login(this.userEmail, this.userPassword)
      .then(() => {
        this.router.navigate(['/sidenav']); // Erfolgreicher Login
      })
      .catch(error => {
        console.error('Login fehlgeschlagen', error);
        alert('Fehler beim Login: ' + error.message); // Fehler anzeigen
      });
  }
 

  guestSucess() {
    this.userService.login('gäste@login.login', 'gästelogin')
      .then(() => {
        this.router.navigate(['/sidenav']); // Erfolgreicher Login
      })
      .catch(error => {
        console.error('Login fehlgeschlagen', error);
        alert('Fehler beim Login: ' + error.message); // Fehler anzeigen
      });
  }

}
