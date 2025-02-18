import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { WorkspaceComponent } from './workspace/workspace.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, WorkspaceComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'dabubble-393';
  isMobile: boolean = false;
  isLoggedIn: boolean = false;

  constructor(
    private auth: Auth,
    private router: Router
  ) {
  }

  ngOnInit() {
    this.auth.onAuthStateChanged((user) => {
      this.isLoggedIn = !!user;
    });
  }
}
