import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { NgClass, NgFor } from '@angular/common';

@Component({
  selector: 'app-choose-avatar',
  imports: [FooterComponent, NgFor,NgClass],
  templateUrl: './choose-avatar.component.html',
  styleUrl: './choose-avatar.component.scss'
})
export class ChooseAvatarComponent {
  constructor(private router: Router) {}

  
  arrowBackSrc: string = '../../../assets/img/arrow-back.png';
  currentAvatarSrc: string = '../../../assets/img/default-avatar.png';

  isFilled: boolean = false;

  avatarImages: string[] = [
    '../../../assets/img/avatars/frederik-beck-avatar.png',
    '../../../assets/img/avatars/elias-neumann-avatar.png',
    '../../../assets/img/avatars/elise-roth-avatar.png',
    '../../../assets/img/avatars/noah-braun-avatar.png',
    '../../../assets/img/avatars/sofia-mueller-avatar.png',
    '../../../assets/img/avatars/steffen-hoffmann-avatar.png',
  ];

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = '../../../assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = '../../../assets/img/arrow-back.png';
    }
  }

  selectAvatar(avatarImage: string): void {
    this.currentAvatarSrc = avatarImage;
    this.enableButton();
  }

  enableButton(){
    this.isFilled = this.currentAvatarSrc !== '../../../assets/img/default-avatar.png';
  }


  backToRegister(): void {
    this.router.navigate(['/signup']);
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

}
