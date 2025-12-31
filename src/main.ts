import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { initializeFirebase } from './app/firebase.config';

// Initialize Firebase before bootstrapping the app
if (typeof window !== 'undefined') {
  try {
    initializeFirebase();
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));

