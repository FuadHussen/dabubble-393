import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-profile-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
  ],
  templateUrl: './user-profile-settings.component.html',
  styleUrl: './user-profile-settings.component.scss',
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
export class UserProfileSettingsComponent implements OnInit {
  @Input() isOpen = false;
  @Output() closeInfo = new EventEmitter<void>();
  
  username: string = '';
  email: string = '';
  userAvatar: string | null = null;
  isOnline = true;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private userService: UserService
  ) {
    // Subscribe to user changes
    this.userService.currentUser$.subscribe(async user => {
      if (user) {
        // Direkt aus der users Collection laden
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          console.log('Profile Settings - Loaded user data:', userData);
          
          this.username = userData['username'] || 'Unbekannt';
          this.email = userData['email'] || '';
          this.userAvatar = userData['avatar'] || 'default-avatar.png';
        }
      }
    });
  }

  ngOnInit() {
    // Initial user data load
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('uid', '==', currentUser.uid));
      getDocs(q).then(querySnapshot => {
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          this.username = userData['username'];
          this.email = userData['email'];
          this.userAvatar = userData['avatar'];
        }
      });
    }
  }

  close(event: MouseEvent) {
    event.stopPropagation();
    this.closeInfo.emit();
  }
}
