import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ResetPasswordComponent } from './login/reset-password/reset-password.component';
import { SignupComponent } from './login/signup/signup.component';
import { ChooseAvatarComponent } from './login/signup/choose-avatar/choose-avatar.component';
import { ImprintComponent } from './shared/imprint/imprint.component';
import { PrivacyPolicyComponent } from './shared/privacy-policy/privacy-policy.component';
import { NewPasswordComponent } from './login/reset-password/new-password/new-password.component';
import { WorkspaceComponent } from './workspace/workspace.component';
import { ChatComponent } from './chat/chat.component';

export const routes: Routes = [
    { path: '', redirectTo: 'workspace', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
    { path: 'new-password', component: NewPasswordComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'choose-avatar', component: ChooseAvatarComponent },
    { 
        path: 'workspace', 
        component: WorkspaceComponent,
        children: [
            { path: '', component: ChatComponent },
            { path: 'channel/:id', component: ChatComponent },
            { path: 'dm/:userId', component: ChatComponent }
        ]
    },
    { path: 'imprint', component: ImprintComponent },
    { path: 'privacy-policy', component: PrivacyPolicyComponent },
];
