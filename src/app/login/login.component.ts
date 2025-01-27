import { Component } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  animations: [
    trigger('moveAnimation', [
      state('center', style({ transform: 'translate(0, 0)' })),
      state('moveToCorner', style({ transform: 'translate(-40vw, -40vh) scale(0.5)' })),
    ]),
    trigger('logoFadeAnimation', [
      state('center', style({ opacity: 0,scale:0.5 })),//start
      state('moveToCorner', style({ opacity: 1,scale:1.5 })),//ende
      transition('center => moveToCorner', animate('2s ease')),//zeit dazwischen
    ]),
    trigger('nameFadeAnimation', [
      state('center', style({ opacity: 0 })),
      state('moveToCorner', style({ opacity: 1, transform: 'translate(24px, 0)' })),
      transition('center => moveToCorner', animate('1s ease-in-out')), // Delay of 1s
    ]),
  ],
})
export class LoginComponent {
  animationState = 'center';
  backgroundColor = 'blue';

  ngOnInit() {
    setTimeout(() => {
      this.animationState = 'moveToCorner';
    }, 60);
  }
}