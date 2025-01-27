import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { ChatComponent } from '../chat/chat.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { MatDialog } from '@angular/material/dialog';
import { AddNewChannelComponent } from './add-new-channel/add-new-channel.component';
import { MatExpansionPanel } from '@angular/material/expansion';
@Component({
  selector: 'app-sidenav-2',
  standalone: true,
  imports: [
    MatSidenavModule, 
    MatButtonModule, 
    MatExpansionModule, 
    MatIconModule,
    CommonModule,
    MatListModule,
    ChatComponent,
    NavbarComponent,
    MatExpansionPanel
  ],
  templateUrl: './sidenav-2.component.html',
  styleUrl: './sidenav-2.component.scss'
})
export class Sidenav2Component {
  readonly panelOpenState = signal(false);
  isActive = false;

  constructor(private dialog: MatDialog) {}

  toggleActive() {
    this.isActive = !this.isActive;
  }

  openAddChannelDialog() {
    const dialogRef = this.dialog.open(AddNewChannelComponent, {
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Hier kannst du die Logik zum Erstellen eines neuen Channels implementieren
        console.log('Neuer Channel:', result);
      }
    });
  }
}
