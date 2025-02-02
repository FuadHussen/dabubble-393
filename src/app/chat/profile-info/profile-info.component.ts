import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-profile-info',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
  ],
  templateUrl: './profile-info.component.html',
  styleUrl: './profile-info.component.scss',
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(-20px)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateY(0)'
      })),
      transition('void => *', [
        animate('125ms ease-out')
      ]),
      transition('* => void', [
        animate('125ms ease-in')
      ])
    ])
  ]
})
export class ProfileInfoComponent {
  @Input() isOpen = false;
  @Input() username: string | null = '';
  @Input() email: string = '';
  @Input() isOnline = true;
  @Output() closeInfo = new EventEmitter<void>();

  close(event: MouseEvent) {
    event.stopPropagation();
    this.closeInfo.emit();
  }

  sendMessage() {
    // Implementierung für Nachricht senden
    console.log('Nachricht senden an:', this.username);
  }
}
