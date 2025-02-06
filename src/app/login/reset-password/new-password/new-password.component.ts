import { Component, OnInit } from '@angular/core';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, NgClass, NgIf } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { confirmPasswordReset } from 'firebase/auth';
@Component({
  selector: 'app-new-password',
  imports: [FooterComponent, NgClass,NgIf, CommonModule],
  templateUrl: './new-password.component.html',
  styleUrl: './new-password.component.scss',
})
export class NewPasswordComponent implements OnInit {
  constructor(private router: Router,    private route: ActivatedRoute,
    private afAuth: Auth) {}

  userPassword: string = '';
  userPasswordControl: string = '';
  oobCode: string | null = null;
  arrowBackSrc: string = '../../../assets/img/arrow-back.png';

  isFilled: boolean = false;

  ngOnInit() {
    // Extrahiere den oobCode aus der URL
    this.route.paramMap.subscribe((params) => {
      this.oobCode = params.get('oobCode');
      if (!this.oobCode) {
        // Falls kein oobCode in der URL ist, sollte der Benutzer zum Login weitergeleitet werden
        this.router.navigate(['/login']);
      }
    });
  }

  arrowBack(state: string) {
    if (state === 'hover') {
      this.arrowBackSrc = '../../../assets/img/arrow-back-active.png';
    } else {
      this.arrowBackSrc = '../../../assets/img/arrow-back.png';
    }
  }

  onInput(field: string, event: Event): void {
    let value = (event.target as HTMLInputElement).value;
    if (field === 'password') {
      this.userPassword = value;
    } else if (field === 'passwordControl') {
      this.userPasswordControl = value;
    }
    this.enableButton();
  }

  enableButton() {
    this.isFilled =
      this.userPassword !== '' &&
      this.userPasswordControl !== '' &&
      this.userPassword === this.userPasswordControl;
  }

  async resetPassword() {
    if (this.oobCode && this.userPassword === this.userPasswordControl) {
      try {
        // Bestätige den Reset-Code und setze das Passwort
        await confirmPasswordReset(this.afAuth, this.oobCode, this.userPasswordControl);
        alert('Passwort erfolgreich geändert.');
        this.router.navigate(['/login']); // Weiterleitung zur Login-Seite
      } catch (error) {
        alert('Fehler beim Zurücksetzen des Passworts. Versuchen Sie es erneut.');
        console.error(error);
      }
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']); // Hier kannst du den gewünschten Pfad angeben
  }
}
