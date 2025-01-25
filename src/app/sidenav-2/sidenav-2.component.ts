import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { ChatComponent } from '../chat/chat.component';
import { NavbarComponent } from '../navbar/navbar.component';

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
    NavbarComponent
  ],
  templateUrl: './sidenav-2.component.html',
  styleUrl: './sidenav-2.component.scss'
})
export class Sidenav2Component {
  readonly panelOpenState = signal(false);
  isActive = false;

  toggleActive() {
    this.isActive = !this.isActive;
  }
}
