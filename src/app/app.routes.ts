import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ResetPasswordComponent } from './login/reset-password/reset-password.component';
import { SignupComponent } from './login/signup/signup.component';
import { ChooseAvatarComponent } from './login/signup/choose-avatar/choose-avatar.component';
import { ImprintComponent } from './shared/imprint/imprint.component';
import { PrivacyPolicyComponent } from './shared/privacy-policy/privacy-policy.component';
import { NewPasswordComponent } from './login/reset-password/new-password/new-password.component';
import { WorkspaceComponent } from './workspace/workspace.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'login', component: LoginComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
    { path: 'new-password', component: NewPasswordComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'choose-avatar', component: ChooseAvatarComponent },
    { path: 'workspace', component: WorkspaceComponent },
    { path: 'imprint', component: ImprintComponent },
    { path: 'privacy-policy', component: PrivacyPolicyComponent },
    { path: 'channel/:channelName/:id', component: WorkspaceComponent },
    { path: 'dm/:userId', component: WorkspaceComponent },
];
