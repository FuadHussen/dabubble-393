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
import { FirebaseError } from 'firebase/app';

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

  // Neue Fehlermeldungen für jedes Feld
  nameErrorMessage: string = '';
  emailErrorMessage: string = '';
  passwordErrorMessage: string = '';

  ngOnInit() {
    // Verhindere Standardvalidierung
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('invalid', (e: Event) => {
        e.preventDefault();
        // Stattdessen deine eigene Validierung starten
        this.validateField(input.name);
      });
    });
  }

  validateField(fieldName: string): void {
    if (fieldName === 'userName') {
      this.validateName();
    } else if (fieldName === 'userEmail') {
      this.validateEmail();
    } else if (fieldName === 'userPassword') {
      this.validatePassword();
    }
  }

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
    if (field === 'userName') {
      this.userNameSrc = 'assets/img/person.png';
      this.isNameTyped = true;
      this.validateName();
    } else if (field === 'userEmail') {
      this.userEmailSrc = 'assets/img/mail.png';
      this.isEmailTyped = true;
      this.validateEmail();
    } else if (field === 'userPassword') {
      this.userPasswordSrc = this.userPassword
        ? 'assets/img/lock-active.png'
        : 'assets/img/lock.png';
      this.isPasswordTyped = true;
      this.validatePassword();
    }
    this.enableButton();
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'userName') {
      this.userName = value;
      this.userNameSrc = value
        ? 'assets/img/person-active.png'
        : 'assets/img/person.png';
      if (this.isNameTyped) {
        this.validateName();
      }
    } else if (field === 'userEmail') {
      this.userEmail = value;
      this.userEmailSrc = value
        ? 'assets/img/mail-active.png'
        : 'assets/img/mail.png';
      if (this.isEmailTyped) {
        this.validateEmail();
      }
    } else if (field === 'userPassword') {
      this.userPassword = value;
      this.userPasswordSrc = value
        ? 'assets/img/lock-active.png'
        : 'assets/img/lock.png';
      
      // Immer validieren, unabhängig von isPasswordTyped
      this.validatePassword();
    }
    this.enableButton();
  }

  // Neue Validierungsfunktionen
  validateName(): void {
    // Prüfe ob der Name leer ist
    if (!this.userName.trim()) {
      this.nameErrorMessage = '*Bitte geben Sie Ihren Namen ein.';
      this.isNameFilled = false;
      return;
    }

    // Prüfe ob der Name mindestens aus zwei Wörtern besteht (Vor- und Nachname)
    const nameParts = this.userName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      this.nameErrorMessage = '*Bitte geben Sie Vor- und Nachnamen ein.';
      this.isNameFilled = false;
      return;
    }

    // Prüfe auf ungültige Zeichen
    const nameRegex = /^[A-Za-zÄäÖöÜüß\s-]+$/;
    if (!nameRegex.test(this.userName)) {
      this.nameErrorMessage = '*Name darf nur Buchstaben, Leerzeichen und Bindestriche enthalten.';
      this.isNameFilled = false;
      return;
    }

    // Name ist gültig
    this.nameErrorMessage = '';
    this.isNameFilled = true;
  }

  validateEmail(): void {
    // Prüfe ob die E-Mail leer ist
    if (!this.userEmail.trim()) {
      this.emailErrorMessage = '*Bitte geben Sie eine E-Mail-Adresse ein.';
      this.isEmailFilled = false;
      return;
    }

    // Prüfe auf ein gültiges E-Mail-Format
    // Strengeres Regex für E-Mail-Validierung
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(this.userEmail)) {
      this.emailErrorMessage = '*Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@beispiel.de).';
      this.isEmailFilled = false;
      return;
    }

    // E-Mail ist gültig
    this.emailErrorMessage = '';
    this.isEmailFilled = true;
  }

  validatePassword(): void {
    // Wenn kein Passwort, dann isPasswordFilled auf false und raus
    if (!this.userPassword) {
      this.isPasswordFilled = false;
      return;
    }

    // Alle Bedingungen direkt prüfen
    const isLongEnough = this.userPassword.length >= 8;
    const hasLetters = /[A-Za-z]/.test(this.userPassword);
    const hasNumbers = /\d/.test(this.userPassword);
    const hasSpecialChars = /[@$!%*?&\-_+=#.,]/.test(this.userPassword);
    
    // Sofort isPasswordFilled setzen, je nachdem ob alle Bedingungen erfüllt sind
    this.isPasswordFilled = isLongEnough && hasLetters && hasNumbers && hasSpecialChars;
    
    // Keine weiteren Verzweigungen notwendig - wir wollen nur, dass der Container
    // verschwindet, wenn alle Bedingungen erfüllt sind
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
    this.isFilled =
      this.checkboxIsCkecked &&
      this.isPasswordFilled &&
      this.isNameFilled &&
      this.isEmailFilled;
  }

  async createUser() {
    // Alle Felder validieren, wenn sie noch nicht ausgefüllt wurden
    if (!this.isNameTyped) {
      this.isNameTyped = true;
      this.validateName();
    }
    
    if (!this.isEmailTyped) {
      this.isEmailTyped = true;
      this.validateEmail();
    }
    
    if (!this.isPasswordTyped) {
      this.isPasswordTyped = true;
      this.validatePassword();
    }
    
    // Überprüfen der Checkbox
    if (!this.checkboxIsCkecked) {
      // Hier kann man eine Meldung hinzufügen, falls gewünscht
      alert('Bitte stimme der Datenschutzerklärung zu, um fortzufahren.');
      return;
    }

    // Nur fortfahren, wenn alle Validierungen bestanden wurden
    if (this.isNameFilled && this.isEmailFilled && this.isPasswordFilled && this.checkboxIsCkecked) {
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
        
        if (error instanceof FirebaseError) {
          if (error.code === 'auth/email-already-in-use') {
            this.emailErrorMessage = '*Diese E-Mail-Adresse wird bereits verwendet.';
            this.isEmailFilled = false;
          } else {
            alert(`Fehler beim Erstellen des Kontos: ${error.message}`);
          }
        } else {
          alert('Fehler beim Erstellen des Kontos. Bitte versuchen Sie es erneut.');
        }
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

  // Hilfsmethoden für die Passwortvalidierung im Template
  isLongEnough(): boolean {
    return this.userPassword.length >= 8;
  }

  hasLetters(): boolean {
    return /[A-Za-z]/.test(this.userPassword);
  }

  hasNumbers(): boolean {
    return /\d/.test(this.userPassword);
  }

  hasSpecialChars(): boolean {
    return /[@$!%*?&\-_+=#.,]/.test(this.userPassword);
  }
}
  // Hilfsmethode zum Aufrufen der richtigen Validierungsfunktion