import { Component } from '@angular/core';
import { FooterComponent } from '../../shared/footer/footer.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  imports: [FooterComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
    constructor(private router: Router) {}
  isEmailFocused = false;
  imgSrc: string = '../../../assets/img/arrow-back.png';

  // Methoden zum Setzen des Fokusstatus
  onEmailFocus() {
    this.isEmailFocused = true;
  }

  onEmailBlur() {
    this.isEmailFocused = false;
  }

  changeImage(state: string) {
    if (state === 'hover') {
      this.imgSrc = '../../../assets/img/arrow-back-active.png';
    } else {
      this.imgSrc = '../../../assets/img/arrow-back.png';
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']); // Hier kannst du den gewünschten Pfad angeben
  }
}
