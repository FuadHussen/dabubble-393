import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-imprint',
  standalone: true,
  imports: [FooterComponent],
  templateUrl: './imprint.component.html',
  styleUrls: ['./imprint.component.scss']
})
export class ImprintComponent {
  constructor(private router: Router) {}

  arrowBackSrc: string = '../../assets/img/arrow-back.png';

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = '../../assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = '../../assets/img/arrow-back.png';
    }
  }

  backToLogin(){
    this.router.navigate(['/login']);
  }
}
