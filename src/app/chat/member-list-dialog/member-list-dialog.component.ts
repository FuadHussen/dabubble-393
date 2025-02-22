import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ProfileInfoComponent } from '../profile-info/profile-info.component';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AvatarService } from '../../services/avatar.service';
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
    private avatarService: AvatarService
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
      
      const channelDoc = await getDoc(doc(this.firestore, 'channels', this.channelId));
      
      if (!channelDoc.exists()) {
        return;
      }

      const channelData = channelDoc.data();

      this.creatorId = channelData['createdBy'] || channelData['createdByUserId'];

      if (this.creatorId && this.members.length > 0) {
        this.updateMembersWithCreator();
      }
    } catch (error) {
      console.error('Error in loadChannelCreator:', error);
    }
  }

  private updateMembersWithCreator() {
    if (!this.creatorId) return;

    
    this.members = this.members.map(member => ({
      ...member,
      isCreator: member.uid === this.creatorId
    }));

  }

  close() {
    this.selectedMember = null;
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

  onMessageStarted() {
    this.selectedMember = null;
    this.closeDialog.emit();
  }

  handleDirectMessageStart() {
    this.onMessageStarted();
  }

  getAvatarSrc(avatar: string | null): string {
    if (!avatar) return '';
    
    if (this.avatarService.isGoogleAvatar(avatar)) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }
    
    return 'assets/img/avatars/' + avatar;
  }
}
