import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { Sidenav2Component } from './sidenav-2/sidenav-2.component';
import { ResetPasswordComponent } from './login/reset-password/reset-password.component';
import { SignupComponent } from './login/signup/signup.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'sidenav', component: SidenavComponent },
    { path: 'sidenav-2', component: Sidenav2Component },
];
