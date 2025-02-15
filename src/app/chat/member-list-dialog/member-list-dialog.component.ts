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
  private creatorId: string | null = null;

  constructor(
    private firestore: Firestore,
  ) {}

  async ngOnInit() {
    if (this.channelId) {
      await this.loadChannelCreator();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['members'] || changes['channelId']) && this.channelId && this.members.length > 0) {
      this.updateMembersWithCreator();
    }
  }

  async loadChannelCreator() {
    try {
      console.log('Loading channel creator for channelId:', this.channelId);
      
      const channelDoc = await getDoc(doc(this.firestore, 'channels', this.channelId));
      
      if (!channelDoc.exists()) {
        console.log('Channel document not found');
        return;
      }

      const channelData = channelDoc.data();
      console.log('Channel data:', channelData);

      this.creatorId = channelData['createdBy'] || channelData['createdByUserId'];
      console.log('Creator ID:', this.creatorId);

      if (this.creatorId && this.members.length > 0) {
        this.updateMembersWithCreator();
      }
    } catch (error) {
      console.error('Error in loadChannelCreator:', error);
    }
  }

  private updateMembersWithCreator() {
    if (!this.creatorId) return;

    console.log('Updating members with creator. Current members:', this.members);
    
    this.members = this.members.map(member => ({
      ...member,
      isCreator: member.uid === this.creatorId
    }));

    console.log('Updated members:', this.members);
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
