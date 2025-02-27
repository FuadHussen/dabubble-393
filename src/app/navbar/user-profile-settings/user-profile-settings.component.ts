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
import { AvatarService } from '../../services/avatar.service';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

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
  userAvatar: string | null = '';
  isOnline = true;
  isEditing = false;
  newUsername: string = '';
  userId: string = '';
  userDocId: string = '';
  
  // Avatar-Bearbeitung
  isEditingAvatar = false;
  availableAvatars: string[] = [
    'noah-braun-avatar.png',
    'sofia-mueller-avatar.png',
    'steffen-hoffmann-avatar.png',
    'elias-neumann-avatar.png',
    'elise-roth-avatar.png',
    'frederik-beck-avatar.png'
  ];
  selectedAvatar: string | null = null;
  uploadedFile: File | null = null;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private storage: Storage,
    private userService: UserService,
    private avatarService: AvatarService
  ) {
    this.userService.currentUser$.subscribe(async user => {
      if (user) {
        this.userId = user.uid;
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          this.userDocId = userDoc.id;
          const userData = userDoc.data();
          this.username = userData['username'] || 'Unbekannt';
          this.newUsername = this.username;
          this.email = userData['email'] || '';
          this.userAvatar = userData['avatar'];
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
        // Update in Firestore
        if (this.userDocId) {
          await updateDoc(doc(this.firestore, 'users', this.userDocId), {
            username: this.newUsername
          });
          
          // Update all messages by this user
          await this.userService.saveUserProfile(
            this.userId,
            { username: this.newUsername }
          );
          
          this.username = this.newUsername;
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

  // Avatar-Bearbeitungsmethoden
  toggleAvatarEdit() {
    this.isEditingAvatar = !this.isEditingAvatar;
    if (this.isEditingAvatar) {
      this.selectedAvatar = this.userAvatar;
      this.uploadedFile = null;
    }
  }

  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    this.uploadedFile = null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadedFile = input.files[0];
      this.selectedAvatar = null;
    }
  }

  async saveAvatar(): Promise<void> {
    try {
      let newAvatarPath = this.userAvatar;

      if (this.uploadedFile) {
        const fileName = `avatars/${this.userId}_${Date.now()}_${this.uploadedFile.name}`;
        const storageRef = ref(this.storage, fileName);
        
        // Upload file
        await uploadBytes(storageRef, this.uploadedFile);
        
        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);
        newAvatarPath = downloadURL;
      } 
      else if (this.selectedAvatar) {
        newAvatarPath = this.selectedAvatar;
      }

      if (newAvatarPath !== null && newAvatarPath !== this.userAvatar && this.userDocId) {
        // Create a safe object to update Firestore - ensures type safety
        const updateData: {avatar: string} = {
          avatar: newAvatarPath as string // Type assertion since we've checked it's not null
        };
        
        // Update in Firestore
        await updateDoc(doc(this.firestore, 'users', this.userDocId), updateData);
        
        // Update all messages by this user
        await this.userService.saveUserProfile(
          this.userId,
          { avatar: newAvatarPath }
        );
        
        this.userAvatar = newAvatarPath;
      }

      this.isEditingAvatar = false;
    } catch (error) {
      console.error('Error updating avatar:', error);
    }
  }

  cancelAvatarEdit() {
    this.isEditingAvatar = false;
    this.selectedAvatar = this.userAvatar;
    this.uploadedFile = null;
  }

  close(event: MouseEvent) {
    event.stopPropagation();
    this.closeInfo.emit();
  }

  ngOnInit() {
    // Initialization code if needed
  }

  getAvatarUrl(avatar: string | null): string {
    if (!avatar) return 'assets/img/avatars/default-avatar.png';
    
    if (avatar.startsWith('http')) {
      return avatar;
    }
    
    return 'assets/img/avatars/' + avatar;
  }
}
