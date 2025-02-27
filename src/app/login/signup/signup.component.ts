import { Component } from '@angular/core';
import { FooterComponent } from '../../shared/footer/footer.component';
import { CommonModule, NgClass } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  setDoc,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FooterComponent, NgClass, CommonModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent {
  private auth: Auth = inject(Auth);
  private userService: UserService = inject(UserService);
  private firestore: Firestore = inject(Firestore);

  constructor(private router: Router) {}

  userName: string = '';
  userEmail: string = '';
  userPassword: string = '';

  arrowBackSrc: string = 'assets/img/arrow-back.png';
  userNameSrc: string = 'assets/img/person.png';
  userEmailSrc: string = 'assets/img/mail.png';
  userPasswordSrc: string = 'assets/img/lock.png';
  checkboxSrc: string = 'assets/img/checkbox.png';

  checkboxIsCkecked: boolean = false;
  checkboxIsHovered: boolean = false;
  isFilled: boolean = false;

  isNameFilled: boolean = false;
  isEmailFilled: boolean = false;
  isPasswordFilled: boolean = false;

  isNameTyped: boolean = false;
  isEmailTyped: boolean = false;
  isPasswordTyped: boolean = false;
  isPasswordVisible: boolean = false;
  isPasswordErrorText: string = '';
  passwordStrengthClass: string = '';
  passwordStrengthClassText: string = '';

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = 'assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = 'assets/img/arrow-back.png';
    }
  }

  onFocus(field: string): void {
    if (field === 'userName' && !this.userName) {
      this.userNameSrc = 'assets/img/person-active.png';
    } else if (field === 'userEmail' && !this.userEmail) {
      this.userEmailSrc = 'assets/img/mail-active.png';
    } else if (field === 'userPassword' && !this.userPassword) {
      this.userPasswordSrc = 'assets/img/lock-active.png';
    }
  }

  onBlur(field: string): void {
    if (field === 'userName' && this.userName.trim().split(/\s+/).length > 1) {
      this.isNameTyped = true;
      this.userNameSrc = 'assets/img/person.png';
      this.isNameFilled = true;
    } else if (field === 'userEmail' && !this.userEmail) {
      this.isEmailTyped = true;
      this.userEmailSrc = 'assets/img/mail.png';
    } else if (field === 'userPassword') {
      this.userPasswordSrc = this.userPassword
        ? 'assets/img/lock-active.png'
        : 'assets/img/lock.png';

      if (this.userPassword.length < 6) {
        this.isPasswordErrorText = 'Passwort zu kurz (min. 6 Zeichen)';
      } else {
        this.passwordStrengthClass = '';
        this.isPasswordErrorText = '';
        this.passwordStrengthClassText = '';
      }
    }
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'userName') {
      this.userName = value;
      this.userNameSrc = value
        ? 'assets/img/person-active.png'
        : 'assets/img/person.png';
      if (this.userName.trim().split(' ').length >= 2) {
        this.isNameTyped = true;
        this.isNameFilled = true;
      } else {
        this.isNameTyped = false;
        this.isNameFilled = false;
      }
    } else if (field === 'userEmail') {
      this.userEmail = value;
      this.userEmailSrc = value
        ? 'assets/img/mail-active.png'
        : 'assets/img/mail.png';
      const emailPattern = /\S+@\S+\.\S+/;
      this.isEmailFilled = emailPattern.test(this.userEmail);
    } else if (field === 'userPassword') {
      this.userPassword = value;
      this.userPasswordSrc = value
        ? 'assets/img/lock-active.png'
        : 'assets/img/lock.png';
      this.checkPasswordStrength();
    }
    this.enableButton();
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
      this.isPasswordFilled = false;
    }if (isMinLength && hasLetters && !hasNumbers && !hasSpecialChars) {
      this.passwordStrengthClass = 'weak';
      this.passwordStrengthClassText = 'schwach';
      this.isPasswordErrorText = 'Passwort Ziel erfüllt, Sicherheit:';
      this.isPasswordFilled = true;
    } else if (isMinLength && hasLetters && hasNumbers && !hasSpecialChars) {
      this.passwordStrengthClass = 'medium';
      this.passwordStrengthClassText = 'mittel';
      this.isPasswordErrorText = 'Passwort Ziel erfüllt, Sicherheit:';
      this.isPasswordFilled = true;
    } else if (isMinLength && hasLetters && hasNumbers && hasSpecialChars) {
      this.passwordStrengthClass = 'strong';
      this.passwordStrengthClassText = 'stark';
      this.isPasswordErrorText = 'Passwort Ziel erfüllt, Sicherheit:';
      this.isPasswordFilled = true;
    } else {
      this.passwordStrengthClass = '';
      this.isPasswordErrorText = '';
      this.passwordStrengthClassText = '';
      this.isPasswordFilled = true;
    }
  }

  togglePasswordVisibility(): void {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  checkboxHover(hoverState: boolean): void {
    this.checkboxIsHovered = hoverState;
    this.checkboxChangeImage();
  }

  checkboxClick(): void {
    this.checkboxIsCkecked = !this.checkboxIsCkecked;
    this.checkboxChangeImage();
    this.enableButton();
  }

  enableButton() {
    console.log('Checkbox Checked:', this.checkboxIsCkecked);
    console.log('Name Filled:', this.isNameFilled);
    console.log('Email Filled:', this.isEmailFilled);
    console.log('Password Filled:', this.isPasswordFilled);

    this.isFilled =
      this.checkboxIsCkecked &&
      this.isPasswordFilled &&
      this.isNameFilled &&
      this.isEmailFilled;
  }

  async createUser() {
    if (this.isFilled) {
      try {
        const auth = getAuth();
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          this.userEmail,
          this.userPassword
        );

        const userId = userCredential.user.uid;
        const userDocRef = doc(this.firestore, 'users', userId);
        await setDoc(userDocRef, {
          uid: userId,
          username: this.userName,
          email: this.userEmail,
        });

        this.userService.updateUsername(this.userName);
        this.router.navigate(['/choose-avatar']);
      } catch (error) {
        console.error('Fehler beim Erstellen des Benutzers:', error);
      }
    }
  }

  checkboxChangeImage(): void {
    if (this.checkboxIsCkecked && this.checkboxIsHovered) {
      this.checkboxSrc = 'assets/img/checkbox-checked-hovered.png';
    } else if (this.checkboxIsCkecked) {
      this.checkboxSrc = 'assets/img/checkbox-checked.png';
    } else if (this.checkboxIsHovered) {
      this.checkboxSrc = 'assets/img/checkbox-hovered.png';
    } else {
      this.checkboxSrc = 'assets/img/checkbox.png';
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  navigateToPrivacyPolicy() {
    this.router.navigate(['/privacy-policy']);
  }
}
