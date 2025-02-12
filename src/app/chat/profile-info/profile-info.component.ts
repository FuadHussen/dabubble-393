import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
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
  @Input() avatar: string | null = null;
  @Input() userId: string = '';
  @Output() closeInfo = new EventEmitter<void>();

  constructor(private router: Router) {}

  close(event: MouseEvent) {
    event.stopPropagation();
    this.closeInfo.emit();
  }

  async startDirectMessage(event: MouseEvent) {
    event.stopPropagation();
    if (this.userId) {
      await this.router.navigate(['/dm', this.userId]);
      this.closeInfo.emit();
    }
  }
}
