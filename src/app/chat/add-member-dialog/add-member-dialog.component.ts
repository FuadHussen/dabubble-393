import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

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
  selectedUser: any = null;
  searchResults: any[] = [];

  constructor(
    private userService: UserService,
    private firestore: Firestore
  ) {}

  close() {
    this.searchText = '';
    this.selectedUser = null;
    this.searchResults = [];
    this.closeDialog.emit();
  }

  async onSearch() {
    if (this.searchText.trim().length > 0) {
      // Suche nach Usern, die noch nicht Mitglied sind
      this.searchResults = await this.userService.searchUsers(
        this.searchText, 
        this.currentMembers
      );
    } else {
      this.searchResults = [];
    }
  }

  removeSelectedUser(event: Event) {
    event.stopPropagation();
    this.selectedUser = null;
    this.searchText = '';
    // Aktiviere das Suchfeld wieder
  }

  selectUser(user: any) {
    this.selectedUser = user;
    this.searchText = user.username;
    this.searchResults = [];
  }

  async addMember() {
    if (this.selectedUser && this.channelId) {
      try {
        const channelMembersRef = collection(this.firestore, 'channelMembers');
        await addDoc(channelMembersRef, {
          channelId: this.channelId,
          userId: this.selectedUser.uid,
          joinedAt: new Date()
        });
        
        console.log('Member added successfully:', this.selectedUser.username);
        this.memberAdded.emit(); // Benachrichtigt den Parent Component
        this.close();
      } catch (error) {
        console.error('Error adding member:', error);
      }
    }
  }
}
