import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { AddChannelMembersComponent } from './add-channel-members/add-channel-members.component';
import { collection, addDoc, query, where, getDocs } from '@angular/fire/firestore';
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
    FormsModule,
    MatSnackBarModule
  ],
  templateUrl: './add-new-channel.component.html',
  styleUrl: './add-new-channel.component.scss'
})
export class AddNewChannelComponent {
  channelName: string = '';
  description: string = '';
  errorMessage: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<AddNewChannelComponent>,
    private dialog: MatDialog,
    private firestore: Firestore,
    private auth: Auth,
    private snackBar: MatSnackBar
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  // Methode zur Überprüfung, ob ein Kanalname bereits existiert
  async checkChannelNameExists(name: string): Promise<boolean> {
    try {
      const channelsRef = collection(this.firestore, 'channels');
      const q = query(channelsRef, where('name', '==', name));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty; // Gibt true zurück, wenn der Name bereits existiert
    } catch (error) {
      console.error('Fehler bei der Überprüfung des Kanalnamens:', error);
      throw error;
    }
  }

  async onCreate() {
    this.errorMessage = null; // Zurücksetzen der Fehlermeldung
    
    if (!this.channelName.trim()) {
      this.errorMessage = "Der Kanalname darf nicht leer sein.";
      this.showErrorMessage(this.errorMessage);
      return;
    }
    
    try {
      // Überprüfen, ob der Kanalname bereits existiert
      const nameExists = await this.checkChannelNameExists(this.channelName);
      
      if (nameExists) {
        this.errorMessage = `Ein Kanal mit dem Namen '${this.channelName}' existiert bereits.`;
        this.showErrorMessage(this.errorMessage);
        return;
      }
      
      // Wenn der Name nicht existiert, öffne den Dialog für Mitglieder
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

            // Erfolgsbenachrichtigung anzeigen
            this.showSuccessMessage(`Kanal '${this.channelName}' erfolgreich erstellt`);
            this.dialogRef.close(true);
          } catch (error) {
            console.error('Error creating channel:', error);
            this.errorMessage = "Bei der Erstellung des Kanals ist ein Fehler aufgetreten. Bitte versuche es erneut.";
            this.showErrorMessage(this.errorMessage);
          }
        }
      });
    } catch (error) {
      console.error('Fehler beim Erstellen des Kanals:', error);
      this.errorMessage = "Bei der Überprüfung des Kanalnamens ist ein Fehler aufgetreten. Bitte versuche es erneut.";
      this.showErrorMessage(this.errorMessage);
    }
  }

  // Methoden für Benachrichtigungen
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
