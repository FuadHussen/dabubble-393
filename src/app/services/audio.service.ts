import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audio = new Audio();

  constructor() {
    this.audio.src = 'assets/sounds/send-message.mp3';
  }

  playMessageSound() {
    this.audio.currentTime = 0;
    this.audio.play().catch(error => console.error('Error playing sound:', error));
  }
} 