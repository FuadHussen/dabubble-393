import { Component } from '@angular/core';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { Router } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
@Component({
  selector: 'app-new-password',
  imports: [FooterComponent, NgClass,NgIf],
  templateUrl: './new-password.component.html',
  styleUrl: './new-password.component.scss',
})
export class NewPasswordComponent {
  constructor(private router: Router) {}

  userPassword: string = '';
  userPasswordControl: string = '';

  arrowBackSrc: string = '../../../assets/img/arrow-back.png';

  isFilled: boolean = false;

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = '../../../assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = '../../../assets/img/arrow-back.png';
    }
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'password') {
      this.userPassword = value;
    } else if (field === 'passwordControl') {
      this.userPasswordControl = value;
    }
    this.enableButton();
  }

  enableButton() {
    this.isFilled =
      this.userPassword !== '' &&
      this.userPasswordControl !== '' &&
      this.userPassword === this.userPasswordControl;
  }

  navigateToLogin() {
    this.router.navigate(['/login']); // Hier kannst du den gewünschten Pfad angeben
  }
}
