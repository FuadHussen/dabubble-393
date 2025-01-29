import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FooterComponent } from '../../shared/footer/footer.component';

@Component({
  selector: 'app-signup',
  imports: [FooterComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  constructor(private router: Router) {}

  userName: string = '';
  userEmail: string = '';
  userPassword: string = '';

  arrowBackSrc: string = '../../../assets/img/arrow-back.png';
  userNameSrc: string = '../../assets/img/person.png';
  userEmailSrc: string = '../../assets/img/mail.png';
  userPasswordSrc: string = '../../assets/img/lock.png';
  checkboxSrc: string = '../../assets/img/checkbox.png';

  checkboxIsCkecked: boolean = false;
  checkboxIsHovered: boolean = false;


  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = '../../../assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = '../../../assets/img/arrow-back.png';
    }
  }

  onFocus(field: string): void {
    if (field === 'userName' && !this.userName) {
      this.userNameSrc = '../../assets/img/person-active.png';
    } else if (field === 'userEmail' && !this.userEmail) {
      this.userEmailSrc = '../../assets/img/mail-active.png';
    } else if (field === 'userPassword' && !this.userPassword) {
      this.userPasswordSrc = '../../assets/img/lock-active.png';
    }
  }

  onBlur(field: string): void {
    if (field === 'userName' && !this.userName) {
      this.userNameSrc = '../../assets/img/person.png';
    } else if (field === 'userEmail' && !this.userEmail) {
      this.userEmailSrc = '../../assets/img/mail.png';
    } else if (field === 'userPassword' && !this.userPassword) {
      this.userPasswordSrc = '../../assets/img/lock.png';
    }
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'userName') {
      this.userName = value;
      this.userNameSrc = value
        ? '../../assets/img/person-active.png'
        : '../../assets/img/person.png';
    } else if (field === 'userEmail') {
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
  }

  checkboxHover(hoverState: boolean): void {
    this.checkboxIsHovered = hoverState;
    this.checkboxChangeImage();
  }

  checkboxClick(): void {
    this.checkboxIsCkecked = !this.checkboxIsCkecked;
    this.checkboxChangeImage();
  }

  checkboxChangeImage(): void {
    if (this.checkboxIsCkecked && this.checkboxIsHovered) {
      this.checkboxSrc = '../../../assets/img/checkbox-checked-hovered.png';
    } else if (this.checkboxIsCkecked) {
      this.checkboxSrc = '../../../assets/img/checkbox-checked.png';
    } else if (this.checkboxIsHovered) {
      this.checkboxSrc = '../../../assets/img/checkbox-hovered.png';
    } else {
      this.checkboxSrc = '../../../assets/img/checkbox.png';
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  navigateToChooseAvatar() {
    this.router.navigate(['/choose-avatar']);
  }

}
