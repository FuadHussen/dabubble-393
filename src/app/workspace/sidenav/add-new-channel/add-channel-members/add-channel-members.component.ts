import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, collectionGroup, addDoc } from '@angular/fire/firestore';
import { UserService } from '../../../../services/user.service';
import { Auth } from '@angular/fire/auth';

interface Channel {
  id: string;
  name: string;
  memberCount: number;
  selected?: boolean;
}

interface ChannelMember {
  userId: string;
  channelId: string;
  deleted?: boolean;
}

interface User {
  uid: string;
  displayName: string;
  email: string;
  avatar?: string;
  selected?: boolean;
}

@Component({
  selector: 'app-add-channel-members',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatRadioModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './add-channel-members.component.html',
  styleUrls: ['./add-channel-members.component.scss']
})
export class AddChannelMembersComponent implements OnInit {
  selectedOption: string = '';
  searchText: string = '';
  existingChannels: Channel[] = [];
  filteredUsers: User[] = [];
  allUsers: User[] = [];
  selectedUsers: Set<string> = new Set();
  showUserList: boolean = false;
  currentUserId: string | null = null;
  channelName: string;
  description: string;

  constructor(
    public dialogRef: MatDialogRef<AddChannelMembersComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      channelName: string,
      description: string
    },
    private firestore: Firestore,
    private userService: UserService,
    private auth: Auth
  ) {
    this.currentUserId = this.auth.currentUser?.uid || null;
    this.channelName = data.channelName;
    this.description = data.description;
  }

  async ngOnInit() {
    await this.loadExistingChannels();
    await this.loadUsers();
  }

  async loadExistingChannels() {
    try {    
      // 1. First check all available channels
      const channelsRef = collection(this.firestore, 'channels');
      const allChannelsSnapshot = await getDocs(channelsRef);
      
      
      // 2. Check user memberships
      const membersRef = collection(this.firestore, 'channelMembers');
      const userMembershipQuery = query(
        membersRef,
        where('userId', '==', this.currentUserId)
      );
      
      const userMemberships = await getDocs(userMembershipQuery);
      const userChannelIds = userMemberships.docs.map(doc => doc.data()['channelId']);
      
      // 3. Process each channel
      const channelsPromises = allChannelsSnapshot.docs.map(async (doc) => {
        const channelId = doc.id;
        const channelData = doc.data();
        
        // Check if user is a member - this is the key check
        const isMember = userChannelIds.includes(channelId);
        
        // Skip channels where user is not a member
        if (!isMember) {
          return null;
        }
        
        // Get all members for this channel
        const memberQuery = query(
          membersRef, 
          where('channelId', '==', channelId)
        );
        
        const memberSnapshot = await getDocs(memberQuery);
        
        // Count unique members
        const uniqueMembers = new Set();
        memberSnapshot.docs.forEach(memberDoc => {
          const memberData = memberDoc.data() as ChannelMember;
          const memberId = memberData['userId'];
          const isDeleted = memberData['deleted'] === true;
          const isCurrentUser = memberId === this.currentUserId;
          
          if (memberId && !isDeleted && !isCurrentUser) {
            uniqueMembers.add(memberId);
          }
        });
        

        return {
          id: channelId,
          name: channelData['name'],
          memberCount: uniqueMembers.size,
          selected: false
        };
      });

      // Filter out channels where user is not a member
      const results = await Promise.all(channelsPromises);
      this.existingChannels = results.filter(channel => channel !== null) as Channel[];
      
    } catch (error) {
      console.error('❌ Error loading channels:', error);
    }
  }

  async loadUsers() {
    try {
      const users = await this.userService.getAllUsers();
      this.allUsers = users
        .filter(user => 
          user.uid !== this.currentUserId && 
          !user.displayName?.toLowerCase().includes('guest') &&
          !user.displayName?.toLowerCase().includes('gäste')
        )
        .map(user => ({
          uid: user.uid,
          displayName: user.displayName || user.username || user.email || 'Unbekannter Benutzer',
          email: user.email || '',
          avatar: user.avatar,
          selected: false
        }));
      this.filterUsers();
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  filterUsers() {
    if (!this.searchText.trim()) {
      this.filteredUsers = [];
      this.showUserList = false;
    } else {
      const searchTerm = this.searchText.toLowerCase();
      this.filteredUsers = this.allUsers.filter(user =>
        (user.displayName.toLowerCase().includes(searchTerm) ||
         user.email.toLowerCase().includes(searchTerm)) &&
        user.uid !== this.currentUserId
      );
      this.showUserList = true;
    }
  }

  onSearchChange() {
    this.filterUsers();
  }

  toggleUserSelection(user: User) {
    if (this.selectedUsers.has(user.uid)) {
      this.selectedUsers.delete(user.uid);
      user.selected = false;
    } else {
      this.selectedUsers.add(user.uid);
      user.selected = true;
    }
  }

  onChannelSelect(channelId: string) {
    this.selectedOption = 'channel_' + channelId;
  }

  onClose(): void {
    this.dialogRef.close();
  }

  async onConfirm(): Promise<void> {
    try {
      if (this.selectedOption.startsWith('channel_')) {
        const sourceChannelId = this.selectedOption.replace('channel_', '');
        // Hole die Mitglieder des ausgewählten Channels
        const channelRef = collection(this.firestore, 'channelMembers');
        const memberQuery = query(channelRef, where('channelId', '==', sourceChannelId));
        const memberSnapshot = await getDocs(memberQuery);
        const members = memberSnapshot.docs.map(doc => doc.data()['userId']);
        
        this.dialogRef.close({ members: members });
      } else if (this.selectedOption === 'select') {
        this.dialogRef.close({ 
          members: Array.from(this.selectedUsers)
        });
      }
    } catch (error) {
      console.error('Error processing members:', error);
      this.dialogRef.close(false);
    }
  }
}
