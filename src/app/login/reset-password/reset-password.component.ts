import { Component } from '@angular/core';
import { FooterComponent } from '../../shared/footer/footer.component';
import { Router } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FooterComponent, NgClass, NgIf],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent {
  constructor(private router: Router, private userService: UserService) {}

  userEmail: string = '';

  arrowBackSrc: string = 'assets/img/arrow-back.png';
  userEmailSrc: string = 'assets/img/mail.png';

  isFilled: boolean = false;

  isEmailFilled: boolean = false;
  isEmailSent: boolean = false;

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = 'assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = 'assets/img/arrow-back.png';
    }
  }

  onFocus(field: string): void {
    if (field === 'userEmail' && !this.userEmail) {
      this.userEmailSrc = 'assets/img/mail-active.png';
    }
  }

  onBlur(field: string): void {
    if (field === 'userEmail' && !this.userEmail) {
      this.userEmailSrc = 'assets/img/mail.png';
    }
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'userEmail') {
      this.userEmail = value;
      this.userEmailSrc = value
        ? 'assets/img/mail-active.png'
        : 'assets/img/mail.png';
      const emailPattern = /\S+@\S+\.\S+/;
      this.isEmailFilled = emailPattern.test(this.userEmail);
    }
    this.enableButton();
  }

  enableButton() {
    this.isFilled = this.isEmailFilled;
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  async navigateToNewPassword() {
    await this.userService.sendPasswordResetEmail(this.userEmail);
    this.isEmailSent = true;
    setTimeout(() => {
      this.isEmailSent = false;
      this.navigateToLogin();
    }, 4000);
  }
}