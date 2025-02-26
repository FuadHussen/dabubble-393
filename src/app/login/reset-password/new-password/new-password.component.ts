import { Component, OnInit } from '@angular/core';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, NgClass, NgIf } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { confirmPasswordReset } from 'firebase/auth';
@Component({
  selector: 'app-new-password',
  standalone: true,
  imports: [FooterComponent, NgClass, NgIf, CommonModule],
  templateUrl: './new-password.component.html',
  styleUrl: './new-password.component.scss',
})
export class NewPasswordComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private afAuth: Auth
  ) {}

  userPassword: string = '';
  userPasswordControl: string = '';
  oobCode: string | null = null;
  arrowBackSrc: string = 'assets/img/arrow-back.png';

  isFilled: boolean = false;
  isPasswordChange: boolean = false;
  isPasswordVisible: boolean = false;
  isPasswordErrorText: string = '';
  passwordStrengthClass: string = '';
  passwordStrengthClassText: string = '';

  ngOnInit() {
    this.oobCode = this.route.snapshot.queryParams['oobCode'];
    if (!this.oobCode) {
      this.router.navigate(['/login']);
    }
  }

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = 'assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = 'assets/img/arrow-back.png';
    }
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'password') {
      this.userPassword = value;
      this.checkPasswordStrength();
    } else if (field === 'passwordControl') {
      this.userPasswordControl = value;
    }
  }

  onBlur(field: string): void {
    if (field === 'passwordControl') {
      this.enableButton();
    }
  }

  checkPasswordStrength(): void {
    const hasLetters = /[A-Za-z]/.test(this.userPassword);
    const hasNumbers = /\d/.test(this.userPassword);
    const hasSpecialChars = /[@$!%*?&]/.test(this.userPassword);
    const isMinLength = this.userPassword.length >= 6;

    if (!isMinLength) {
      this.isPasswordErrorText = 'Passwort zu kurz (min. 6 Zeichen)';
      this.passwordStrengthClass = '';
      this.passwordStrengthClassText = '';
    } else if (hasLetters && !hasNumbers && !hasSpecialChars) {
      this.passwordStrengthClass = 'weak';
      this.passwordStrengthClassText = 'schwach';
      this.isPasswordErrorText = 'Passwort Sicherheit:';
    } else if (hasLetters && hasNumbers && !hasSpecialChars) {
      this.passwordStrengthClass = 'medium';
      this.passwordStrengthClassText = 'mittel';
      this.isPasswordErrorText = 'Passwort Sicherheit:';
    } else if (hasLetters && hasNumbers && hasSpecialChars) {
      this.passwordStrengthClass = 'strong';
      this.passwordStrengthClassText = 'stark';
      this.isPasswordErrorText = 'Passwort Sicherheit:';
    } else {
      this.passwordStrengthClass = '';
      this.isPasswordErrorText = '';
      this.passwordStrengthClassText = '';
    }
  }

  enableButton() {
    if (
      this.userPassword !== '' &&
      this.userPasswordControl !== '' &&
      this.userPassword === this.userPasswordControl
    ) {
      this.isFilled = true;
      this.isPasswordErrorText = '';
      this.passwordStrengthClassText = '';
      this.passwordStrengthClass = '';
    } else {
      this.passwordStrengthClassText = '';
      this.passwordStrengthClass = '';
      this.isPasswordErrorText = 'Passwörter stimmen nicht Überein';
    }
  }

  async resetPassword() {
    if (this.oobCode && this.userPassword === this.userPasswordControl) {
      try {
        await confirmPasswordReset(
          this.afAuth,
          this.oobCode,
          this.userPasswordControl
        );
        this.isPasswordChange = true;
        setTimeout(() => {
          this.isPasswordChange = false;
          this.navigateToLogin();
        }, 4000);
      } catch (error) {
        console.error(error);
      }
    }
  }

  togglePasswordVisibility(): void {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
