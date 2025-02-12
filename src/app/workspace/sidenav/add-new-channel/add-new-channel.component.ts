import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { AddChannelMembersComponent } from './add-channel-members/add-channel-members.component';
import { collection, addDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';


@Component({
  selector: 'app-add-new-channel',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule
  ],
  templateUrl: './add-new-channel.component.html',
  styleUrl: './add-new-channel.component.scss'
})
export class AddNewChannelComponent {
  channelName: string = '';
  description: string = '';

  constructor(
    public dialogRef: MatDialogRef<AddNewChannelComponent>,
    private dialog: MatDialog,
    private firestore: Firestore,
    private auth: Auth
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  async onCreate() {
    const dialogRef = this.dialog.open(AddChannelMembersComponent, {
      width: '500px',
      data: { 
        channelName: this.channelName,
        description: this.description
      }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          const currentUserId = this.auth.currentUser?.uid;
          
          // Channel erstellen
          const channelsRef = collection(this.firestore, 'channels');
          const channelDoc = await addDoc(channelsRef, {
            name: this.channelName,
            description: this.description,
            createdBy: currentUserId,
            createdAt: new Date()
          });

          // Channelmitglieder hinzufügen
          const channelMembersRef = collection(this.firestore, 'channelMembers');
          
          // Ersteller als erstes Mitglied hinzufügen
          await addDoc(channelMembersRef, {
            channelId: channelDoc.id,
            userId: currentUserId,
            joinedAt: new Date()
          });

          // Dann die ausgewählten Mitglieder hinzufügen
          for (const userId of result.members) {
            if (userId !== currentUserId) { // Verhindere Duplikate
              await addDoc(channelMembersRef, {
                channelId: channelDoc.id,
                userId: userId,
                joinedAt: new Date()
              });
            }
          }

          this.dialogRef.close(true);
        } catch (error) {
          console.error('Error creating channel:', error);
        }
      }
    });
  }
}
