import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { Sidenav2Component } from './sidenav-2/sidenav-2.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'sidenav', component: SidenavComponent },
    { path: 'sidenav-2', component: Sidenav2Component },
];
