import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [FooterComponent],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent {
  constructor(
    private location: Location,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  arrowBackSrc: string = 'assets/img/arrow-back.png';

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = 'assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = 'assets/img/arrow-back.png';
    }
  }

  backToLogin() {
    this.location.back();
  }
}
