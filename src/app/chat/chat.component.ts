import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TextFieldModule } from '@angular/cdk/text-field';
import { ChatService } from '../services/chat.service';
import { ChannelSettingsComponent } from './channel-settings/channel-settings.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    TextFieldModule,
    ChannelSettingsComponent,
    FormsModule
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})

export class ChatComponent implements OnInit {
  selectedChannel: string = '';
  isDirectMessage: boolean = false;
  selectedUser: string = '';
  showSettings = false;

  constructor(private chatService: ChatService) {}

  ngOnInit() {
    this.chatService.selectedChannel$.subscribe(channel => {
      this.selectedChannel = channel;
    });

    this.chatService.isDirectMessage$.subscribe(isDM => {
      this.isDirectMessage = isDM;
    });

    this.chatService.selectedUser$.subscribe(user => {
      this.selectedUser = user;
    });
  }

  getPlaceholderText(): string {
    if (this.isDirectMessage) {
      return `Nachricht an @${this.selectedUser}`;
    } else {
      return `Nachricht an #${this.selectedChannel}`;
    }
  }

  openSettings() {
    console.log('Opening settings...'); // Debug-Log
    this.showSettings = true;
  }

  closeSettings() {
    this.showSettings = false;
  }

  saveSettings(settings: {name: string, description: string}) {
    console.log('Neue Einstellungen:', settings);
    this.showSettings = false;
  }
}

