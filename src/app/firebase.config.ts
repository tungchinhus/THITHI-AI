import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getAuth, Auth } from 'firebase/auth';
import { environment } from '../environments/environment';

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let auth: Auth | null = null;

/**
 * Initialize Firebase App
 */
export function initializeFirebase(): FirebaseApp {
  if (!app) {
    const apps = getApps();
    if (apps.length === 0) {
      app = initializeApp(environment.firebaseConfig);
      
      // Initialize Analytics (only in browser environment)
      if (typeof window !== 'undefined') {
        try {
          analytics = getAnalytics(app);
        } catch (error) {
          console.warn('Analytics initialization failed:', error);
        }
      }
      
      // Don't initialize Auth automatically to avoid Identity Toolkit API errors
      // Auth will be initialized lazily when needed via getFirebaseAuth()
    } else {
      app = apps[0];
    }
  }
  
  return app;
}

/**
 * Get Firebase App instance
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!app) {
    initializeFirebase();
  }
  return app;
}

/**
 * Get Firebase Auth instance (lazy initialization)
 */
export function getFirebaseAuth(): Auth | null {
  try {
    if (!auth) {
      const appInstance = initializeFirebase();
      if (appInstance) {
        auth = getAuth(appInstance);
      }
    }
    return auth;
  } catch (error) {
    console.warn('Firebase Auth initialization failed:', error);
    return null;
  }
}

/**
 * Get Firebase Analytics instance
 */
export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}

// Initialize Firebase when module is loaded
if (typeof window !== 'undefined') {
  initializeFirebase();
}

