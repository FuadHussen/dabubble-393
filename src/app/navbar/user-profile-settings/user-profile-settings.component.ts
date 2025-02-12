import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, doc, updateDoc } from '@angular/fire/firestore';
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
    MatInputModule,
    FormsModule
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
  isEditing = false;
  newUsername: string = '';
  userId: string = '';

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private userService: UserService
  ) {
    this.userService.currentUser$.subscribe(async user => {
      if (user) {
        this.userId = user.uid;
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          this.username = userData['username'] || 'Unbekannt';
          this.newUsername = this.username;
          this.email = userData['email'] || '';
          this.userAvatar = userData['avatar'] || 'default-avatar.png';
        }
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.newUsername = this.username;
    }
  }

  async saveUsername() {
    if (this.newUsername.trim() && this.newUsername !== this.username) {
      try {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('uid', '==', this.userId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(doc(this.firestore, 'users', userDoc.id), {
            username: this.newUsername
          });
          
          this.username = this.newUsername;
          this.userService.updateUsername(this.newUsername);
        }
      } catch (error) {
        console.error('Error updating username:', error);
      }
    }
    this.isEditing = false;
  }

  cancelEdit() {
    this.isEditing = false;
    this.newUsername = this.username;
  }

  close(event: MouseEvent) {
    event.stopPropagation();
    this.closeInfo.emit();
  }

  ngOnInit() {

  }
}
