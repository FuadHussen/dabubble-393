import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login.component';
import { SidenavComponent } from './sidenav/sidenav.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'sidenav', component: SidenavComponent },
];
