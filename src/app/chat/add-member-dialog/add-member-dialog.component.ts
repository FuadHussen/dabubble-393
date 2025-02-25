import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { AvatarService } from '../../services/avatar.service';

interface UserData {
  uid: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline?: boolean;
}
@Component({
  selector: 'app-add-member-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule
  ],
  templateUrl: './add-member-dialog.component.html',
  styleUrls: ['./add-member-dialog.component.scss']
})
export class AddMemberDialogComponent {
  @Input() isOpen = false;
  @Input() channelName = '';
  @Input() channelId = '';
  @Input() currentMembers: string[] = [];
  @Output() closeDialog = new EventEmitter<void>();
  @Output() memberAdded = new EventEmitter<void>();
  
  searchText = '';
  selectedUsers: UserData[] = [];
  searchResults: UserData[] = [];

  constructor(
    private userService: UserService,
    private firestore: Firestore,
    private avatarService: AvatarService
  ) {}

  close() {
    this.searchText = '';
    this.selectedUsers = [];
    this.searchResults = [];
    this.closeDialog.emit();
  }

  async onSearch() {
    try {
      if (this.searchText.trim().length > 0) {
        // Hole alle Benutzer
        const users = await this.userService.searchUsers(this.searchText.trim());
        
        // Normalisiere die IDs für den Vergleich
        const normalizedCurrentMembers = this.currentMembers.map(id => id.trim());
        
        // Filtere die Ergebnisse
        this.searchResults = users.filter(user => {
          const normalizedUserId = user.uid.trim();
          
          const isAlreadyMember = normalizedCurrentMembers.some(memberId => 
            memberId === normalizedUserId
          );
          
          const isAlreadySelected = this.selectedUsers.some(selectedUser => 
            selectedUser.uid === normalizedUserId
          );
          
          return !isAlreadyMember && !isAlreadySelected;
        });

      } else {
        this.searchResults = [];
      }
    } catch (error) {
      console.error('Error in onSearch:', error);
      this.searchResults = [];
    }
  }

  selectUser(user: UserData) {
    if (!this.selectedUsers.find(u => u.uid === user.uid)) {
      this.selectedUsers.push(user);
    }
  }

  removeSelectedUser(user: UserData, event: Event) {
    event.stopPropagation();
    this.selectedUsers = this.selectedUsers.filter(u => u.uid !== user.uid);
  }

  async addMember() {
    if (this.selectedUsers.length > 0 && this.channelId) {
      try {
        const channelMembersRef = collection(this.firestore, 'channelMembers');
        
        // Füge alle ausgewählten User hinzu
        for (const user of this.selectedUsers) {
          await addDoc(channelMembersRef, {
            channelId: this.channelId,
            userId: user.uid,
            joinedAt: new Date()
          });
        }
        
        this.memberAdded.emit();
        this.close();
      } catch (error) {
        console.error('Error adding members:', error);
      }
    }
  }

  isUserSelected(user: UserData): boolean {
    return this.selectedUsers.some(u => u.uid === user.uid);
  }

  getAvatarSrc(avatar: string | null): string {
    if (!avatar) return '';
    
    if (this.avatarService.isGoogleAvatar(avatar)) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }
    
    return 'assets/img/avatars/' + avatar;
  }
}
