import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Firestore, deleteDoc, doc, updateDoc, getDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { Auth } from '@angular/fire/auth';
import { AvatarService } from '../../services/avatar.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

interface Member {
  uid: string;
  username: string;
  avatar: string;
  email?: string;
  isCreator?: boolean;
  isOnline?: boolean;
}

@Component({
  selector: 'app-channel-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    FormsModule,
    MatSnackBarModule
  ],
  templateUrl: './channel-settings.component.html',
  styleUrls: ['./channel-settings.component.scss'],
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0,
        height: '0px',
        padding: '0px',
        margin: '0px'
      })),
      state('*', style({
        opacity: 1,
        height: '*',
        padding: '*',
        margin: '*'
      })),
      transition('void <=> *', animate('125ms ease-in-out')),
      transition('* <=> void', animate('125ms ease-in-out'))
    ])
  ]
})
export class ChannelSettingsComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() channelName = '';
  @Input() channelDescription = '';
  @Input() createdBy = '';
  @Input() channelId = '';
  @Output() closeSettings = new EventEmitter<void>();
  
  isEditingName = false;
  isEditingDescription = false;
  editedName = '';
  editedDescription = '';
  members: Member[] = [];
  errorMessage: string | null = null;

  constructor(
    private firestore: Firestore,
    private router: Router,
    private chatService: ChatService,
    private auth: Auth,
    private avatarService: AvatarService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    if (this.channelId) {
      this.loadCreatorInfo();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['channelId'] && !changes['channelId'].firstChange) {
      this.loadCreatorInfo();
    }
  }

  async loadCreatorInfo() {
    try {
      // Hole zuerst den Channel um den Creator zu bekommen
      const channelRef = doc(this.firestore, 'channels', this.channelId);
      const channelSnap = await getDoc(channelRef);
      
      if (!channelSnap.exists()) {
        console.error('Channel document does not exist');
        return;
      }

      const channelData = channelSnap.data();
      
      // Hole die createdBy ID aus dem Channel
      const creatorId = channelData['createdBy'];

      if (!creatorId) {
        console.error('No creator ID found in channel');
        return;
      }

      // Hole die User-Informationen des Creators
      const userDoc = await getDoc(doc(this.firestore, 'users', creatorId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        const member: Member = {
          uid: creatorId,
          username: userData['username'] || 'Unbekannter Benutzer',
          avatar: userData['avatar'],
          email: userData['email'],
          isCreator: true,
          isOnline: userData['isOnline'] || false
        };
        this.members = [member];
      } else {
        console.error('Creator user document does not exist');
      }
    } catch (error) {
      console.error('Error in loadCreatorInfo:', error);
    }
  }

  startEditingName() {
    this.errorMessage = null;
    this.editedName = this.channelName;
    this.isEditingName = true;
  }

  startEditingDescription() {
    this.errorMessage = null;
    this.editedDescription = this.channelDescription;
    this.isEditingDescription = true;
  }

  async checkChannelNameExists(name: string): Promise<boolean> {
    try {
      const channelsRef = collection(this.firestore, 'channels');
      const q = query(channelsRef, where('name', '==', name));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return false; // Kein Duplikat gefunden
      }
      
      // Wenn genau ein Dokument gefunden wird und es das aktuelle ist, ist es kein Duplikat
      if (querySnapshot.size === 1 && querySnapshot.docs[0].id === this.channelId) {
        return false;
      }
      
      return true; // Duplikat gefunden
    } catch (error) {
      console.error('Fehler bei der Überprüfung des Kanalnamens:', error);
      throw error;
    }
  }

  async saveChannelName() {
    this.errorMessage = null; // Zurücksetzen der Fehlermeldung
    
    if (!this.editedName.trim()) {
      this.errorMessage = "Der Kanalname darf nicht leer sein.";
      this.showErrorMessage(this.errorMessage);
      return;
    }
    
    try {
      // Überprüfen, ob der Name bereits existiert
      const nameExists = await this.checkChannelNameExists(this.editedName);
      
      if (nameExists) {
        this.errorMessage = `Ein Kanal mit dem Namen '${this.editedName}' existiert bereits.`;
        this.showErrorMessage(this.errorMessage);
        return;
      }
      
      // Wenn der Name nicht existiert und sich vom aktuellen unterscheidet
      if (this.editedName !== this.channelName) {
        const channelRef = doc(this.firestore, 'channels', this.channelId);
        await updateDoc(channelRef, {
          name: this.editedName
        });
        this.channelName = this.editedName;
        this.chatService.selectChannel(this.editedName);
        
        // Erfolgsbenachrichtigung anzeigen
        this.showSuccessMessage('Kanalname erfolgreich aktualisiert');
      }
      this.isEditingName = false;
    } catch (error) {
      console.error('Fehler beim Speichern des Kanalnamens:', error);
      this.errorMessage = "Bei der Aktualisierung ist ein Fehler aufgetreten. Bitte versuche es erneut.";
      this.showErrorMessage(this.errorMessage);
    }
  }

  async saveChannelDescription() {
    this.errorMessage = null;
    
    try {
      if (this.editedDescription !== this.channelDescription) {
        const channelRef = doc(this.firestore, 'channels', this.channelId);
        await updateDoc(channelRef, {
          description: this.editedDescription
        });
        this.channelDescription = this.editedDescription;
        
        // Erfolgsbenachrichtigung anzeigen
        this.showSuccessMessage('Kanalbeschreibung erfolgreich aktualisiert');
      }
      this.isEditingDescription = false;
    } catch (error) {
      console.error('Fehler beim Speichern der Kanalbeschreibung:', error);
      this.errorMessage = "Bei der Aktualisierung ist ein Fehler aufgetreten. Bitte versuche es erneut.";
      this.showErrorMessage(this.errorMessage);
    }
  }

  cancelEdit(field: 'name' | 'description') {
    this.errorMessage = null;
    
    if (field === 'name') {
      this.isEditingName = false;
      this.editedName = this.channelName;
    } else {
      this.isEditingDescription = false;
      this.editedDescription = this.channelDescription;
    }
  }

  close(event: Event) {
    event.preventDefault();
    this.errorMessage = null;
    this.isEditingName = false;
    this.isEditingDescription = false;
    this.closeSettings.emit();
  }

  async leaveChannel() {
    try {
      if (!this.channelId) {
        console.error('❌ DEBUG: No valid channel ID available');
        return;
      }

      const currentUserId = this.auth.currentUser?.uid;
      if (!currentUserId) {
        console.error('❌ DEBUG: No logged in user');
        return;
      }
      
      // Search for the channelMembers entry for this user and channel
      const channelMembersRef = collection(this.firestore, 'channelMembers');
      const q = query(channelMembersRef, 
        where('channelId', '==', this.channelId),
        where('userId', '==', currentUserId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('❌ DEBUG: User is not a member of this channel');
        return;
      }
      
      // Delete the user's entry from channelMembers
      const memberDoc = querySnapshot.docs[0];
      await deleteDoc(doc(this.firestore, 'channelMembers', memberDoc.id));
      // Show success notification
      this.showSuccessMessage('Du hast den Channel verlassen');
      
      // Trigger channel refresh
      this.chatService.triggerChannelsRefresh();
      
      // Close dialog
      this.closeSettings.emit();
      
      // Navigate to the next available channel or DM
      await this.chatService.selectNextAvailableChannel();
    } catch (error) {
      console.error('❌ DEBUG: Error in leaveChannel:', error);
      this.errorMessage = "Beim Verlassen des Channels ist ein Fehler aufgetreten.";
      this.showErrorMessage(this.errorMessage);
    }
  }

  getAvatarSrc(avatar: string | null): string {
    if (!avatar) return '';
    
    if (this.avatarService.isGoogleAvatar(avatar)) {
      return this.avatarService.transformGooglePhotoUrl(avatar);
    }
    
    return 'assets/img/avatars/' + avatar;
  }

  showErrorMessage(message: string) {
    this.snackBar.open(message, 'Schließen', {
      duration: 5000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  showSuccessMessage(message: string) {
    this.snackBar.open(message, 'Schließen', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}