import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { ResetPasswordComponent } from './login/reset-password/reset-password.component';
import { SignupComponent } from './login/signup/signup.component';
import { ChooseAvatarComponent } from './login/signup/choose-avatar/choose-avatar.component';
import { ImprintComponent } from './shared/imprint/imprint.component';
import { PrivacyPolicyComponent } from './shared/privacy-policy/privacy-policy.component';
import { NewPasswordComponent } from './login/reset-password/new-password/new-password.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
    { path: 'new-password', component: NewPasswordComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'choose-avatar', component: ChooseAvatarComponent },
    { path: 'sidenav', component: SidenavComponent },
    { path: 'imprint', component: ImprintComponent },
    { path: 'privacy-policy', component: PrivacyPolicyComponent },
];
