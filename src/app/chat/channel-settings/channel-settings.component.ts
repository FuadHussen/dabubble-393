import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Firestore, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { trigger, state, style, animate, transition } from '@angular/animations';

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
    FormsModule
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
export class ChannelSettingsComponent {
  @Input() isOpen = false;
  @Input() channelName = '';
  @Input() channelDescription = '';
  @Input() createdBy = '';
  @Input() channelId = '';
  @Output() closeSettings = new EventEmitter<void>();
  
  // Neue Properties für die Bearbeitung
  isEditingName = false;
  isEditingDescription = false;
  editedName = '';
  editedDescription = '';

  constructor(
    private firestore: Firestore,
    private router: Router,
    private chatService: ChatService
  ) {}

  startEditingName() {
    this.editedName = this.channelName;
    this.isEditingName = true;
  }

  startEditingDescription() {
    this.editedDescription = this.channelDescription;
    this.isEditingDescription = true;
  }

  async saveChannelName() {
    if (this.editedName.trim() && this.editedName !== this.channelName) {
      const channelRef = doc(this.firestore, 'channels', this.channelId);
      await updateDoc(channelRef, {
        name: this.editedName
      });
      this.channelName = this.editedName;
      this.chatService.selectChannel(this.editedName);
    }
    this.isEditingName = false;
  }

  async saveChannelDescription() {
    if (this.editedDescription !== this.channelDescription) {
      const channelRef = doc(this.firestore, 'channels', this.channelId);
      await updateDoc(channelRef, {
        description: this.editedDescription
      });
      this.channelDescription = this.editedDescription;
    }
    this.isEditingDescription = false;
  }

  cancelEdit(field: 'name' | 'description') {
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
    this.closeSettings.emit();
  }

  async leaveChannel() {
    try {
      if (!this.channelId) {
        console.error('Keine gültige Channel-ID vorhanden');
        return;
      }
      
      
      // Referenz zum Channel-Dokument erstellen
      const channelRef = doc(this.firestore, 'channels', this.channelId);
      
      // Channel aus der Datenbank löschen
      await deleteDoc(channelRef);
      
      // Dialog schließen
      this.closeSettings.emit();
      
      // Event emittieren, damit die übergeordnete Komponente weiß, 
      // dass sie den nächsten Channel auswählen soll
      this.chatService.selectNextAvailableChannel();
      
    } catch (error) {
      console.error('Fehler beim Verlassen des Channels:', error);
    }
  }
}