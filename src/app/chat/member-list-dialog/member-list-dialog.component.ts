import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ProfileInfoComponent } from '../profile-info/profile-info.component';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

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
export class MemberListDialogComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() members: Member[] = [];
  @Input() channelId: string = '';
  @Output() closeDialog = new EventEmitter<void>();
  @Output() openAddMember = new EventEmitter<void>();

  selectedMember: Member | null = null;

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    console.log('MemberListDialog initialized with channelId:', this.channelId);
    if (this.channelId) {
      await this.updateCreatorStatus();
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    console.log('Changes detected:', changes);
    if (changes['channelId'] && !changes['channelId'].firstChange) {
      await this.updateCreatorStatus();
    }
    if (changes['members']) {
      console.log('New members:', this.members);
    }
  }

  async updateCreatorStatus() {
    try {
      console.log('Updating creator status for channelId:', this.channelId);
      const channelRef = doc(this.firestore, 'channels', this.channelId);
      const channelSnap = await getDoc(channelRef);
      
      if (!channelSnap.exists()) {
        console.error('Channel document does not exist');
        return;
      }

      const channelData = channelSnap.data();
      // Prüfe beide möglichen Felder
      const creatorId = channelData['createdByUserId'] || channelData['createdBy'];
      console.log('Channel data:', channelData);
      console.log('Creator ID:', creatorId);

      this.members = this.members.map(member => {
        const isCreator = member.uid === creatorId;
        console.log(`Checking if member ${member.username} (${member.uid}) is creator:`, isCreator);
        return {
          ...member,
          isCreator: isCreator
        };
      });
      console.log('Updated members:', this.members);
    } catch (error) {
      console.error('Error updating creator status:', error);
    }
  }

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
