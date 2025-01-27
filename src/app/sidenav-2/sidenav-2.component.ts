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
  selectedChannel: string = '';
  channels: string[] = ['channel 1', 'channel 2'];
  isActive: boolean = false;

  constructor(private dialog: MatDialog) {}

  selectChannel(channel: string) {
    this.selectedChannel = channel;
  }

  openAddChannelDialog() {
    const dialogRef = this.dialog.open(AddNewChannelComponent, {
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.name) {
        this.channels.push(result.name);
        this.selectChannel(result.name);
      }
    });
  }
}
