import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ProfileInfoComponent } from '../profile-info/profile-info.component';

interface Member {
  uid: string;
  username: string;
  avatar: string;
  email?: string;
  isCreator?: boolean;
  isOnline?: boolean;
}

@Component({
  selector: 'app-member-list-dialog',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, ProfileInfoComponent],
  templateUrl: './member-list-dialog.component.html',
  styleUrls: ['./member-list-dialog.component.scss']

})
export class MemberListDialogComponent {
  @Input() isOpen = false;
  @Input() members: Member[] = [];
  @Output() closeDialog = new EventEmitter<void>();
  @Output() openAddMember = new EventEmitter<void>();

  selectedMember: Member | null = null;

  close() {
    this.closeDialog.emit();
  }

  addMember() {
    this.openAddMember.emit();
    this.close();
  }

  showProfile(member: Member) {
    this.selectedMember = member;
  }

  closeProfile() {
    this.selectedMember = null;
  }
}
