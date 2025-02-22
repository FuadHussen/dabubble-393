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
      const channelsRef = collection(this.firestore, 'channels');
      const querySnapshot = await getDocs(channelsRef);
      
      const channelsPromises = querySnapshot.docs.map(async (doc) => {
        const channelData = doc.data();
        
        // Lade die Channel-Mitglieder
        const membersRef = collection(this.firestore, 'channelMembers');
        const memberQuery = query(
          membersRef, 
          where('channelId', '==', doc.id)
        );
        
        const memberSnapshot = await getDocs(memberQuery);
        console.log(`Channel ${channelData['name']} raw members:`, memberSnapshot.docs.map(d => d.data())); // Debug-Log
        
        // Zähle nur einzigartige Benutzer
        const uniqueMembers = new Set();
        memberSnapshot.docs.forEach(memberDoc => {
          const memberData = memberDoc.data() as ChannelMember;
          console.log(`Member data for ${channelData['name']}:`, memberData); // Debug-Log
          
          // Prüfe ob das Mitglied nicht gelöscht wurde und eine userId hat
          if (memberData['userId'] && memberData['deleted'] !== true) {
            uniqueMembers.add(memberData['userId']);
          }
        });

        console.log(`Channel ${channelData['name']} unique members:`, uniqueMembers); // Debug-Log

        return {
          id: doc.id,
          name: channelData['name'],
          memberCount: uniqueMembers.size,
          selected: false
        };
      });

      this.existingChannels = await Promise.all(channelsPromises);
      
      console.log('Final channels data:', this.existingChannels); // Debug-Log
    } catch (error) {
      console.error('Error loading channels:', error);
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
