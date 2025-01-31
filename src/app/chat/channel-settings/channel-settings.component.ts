import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';

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
  styleUrls: ['./channel-settings.component.scss']
})
export class ChannelSettingsComponent {
  @Input() isOpen = false;
  @Input() channelName = '';
  @Input() channelDescription = '';
  @Input() createdBy = 'Max Mustermann'; // Beispielwert
  @Output() closeSettings = new EventEmitter<void>();
  @Output() saveSettings = new EventEmitter<{name: string, description: string}>();

  close(event: Event) {
    event.preventDefault();
    this.closeSettings.emit();
  }

  save() {
    this.saveSettings.emit({
      name: this.channelName,
      description: this.channelDescription
    });
    this.closeSettings.emit();
  }

  leaveChannel() {
    // Implementiere hier die Logik zum Verlassen des Channels
    console.log('Channel verlassen');
  }
}