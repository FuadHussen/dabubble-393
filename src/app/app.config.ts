import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';



const firebaseConfig = {
  apiKey: "AIzaSyAY4uKh4z8g8tqAl4_zW_qfsH6UuXoXVUs",
  authDomain: "dabubble-393-d15c3.firebaseapp.com",
  databaseURL: "https://dabubble-393-d15c3-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "dabubble-393-d15c3",
  storageBucket: "dabubble-393-d15c3.firebasestorage.app",
  messagingSenderId: "974960848717",
  appId: "1:974960848717:web:598350bc20868158aed104",
  measurementId: "G-ZTEZRLYJMM"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()), 
    provideFirestore(() => getFirestore()),
    provideAnalytics(() => getAnalytics()),
  ]
};