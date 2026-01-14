import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { getFirebaseAuth } from './firebase.config';
import { signInWithCustomToken, User } from 'firebase/auth';

/**
 * Telegram Mini App Authentication Service
 * Handles authentication flow for Telegram Mini App users
 */
@Injectable({
  providedIn: 'root'
})
export class TelegramAuthService {
  private readonly onboardingUrl: string;
  private readonly loginUrl: string;

  constructor(private http: HttpClient) {
    // Get base URL from Firebase Function URL
    const baseUrl = environment.firebaseFunctionUrl.replace(/\/chatFunction$/, '');
    this.onboardingUrl = `${baseUrl}/telegramOnboarding`;
    this.loginUrl = `${baseUrl}/telegramLogin`;
  }

  /**
   * Check if running in Telegram Mini App
   */
  isTelegramMiniApp(): boolean {
    return typeof window !== 'undefined' && 
           window.Telegram !== undefined && 
           window.Telegram.WebApp !== undefined;
  }

  /**
   * Get Telegram WebApp instance
   */
  getTelegramWebApp(): any {
    if (this.isTelegramMiniApp() && window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp;
    }
    return null;
  }

  /**
   * Get Telegram initData from WebApp
   * This is the data that needs to be verified by the backend
   */
  getTelegramInitData(): string | null {
    const webApp = this.getTelegramWebApp();
    if (webApp && webApp.initData) {
      return webApp.initData;
    }
    return null;
  }

  /**
   * Get Telegram user info from WebApp
   */
  getTelegramUser(): any {
    const webApp = this.getTelegramWebApp();
    if (webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
      return webApp.initDataUnsafe.user;
    }
    return null;
  }

  /**
   * Onboarding: Link phone number to Telegram ID
   * Called by Telegram Bot when user shares contact
   * 
   * @param phoneNumber Phone number from Telegram contact
   * @param telegramId Telegram user ID
   */
  linkPhoneNumber(phoneNumber: string, telegramId: string): Observable<any> {
    return this.http.post(this.onboardingUrl, {
      phoneNumber,
      telegramId
    });
  }

  /**
   * Login: Authenticate Telegram user and get Firebase Custom Token
   * 
   * @param initData Telegram initData (from WebApp.initData)
   */
  loginWithTelegram(initData: string): Observable<{ customToken: string; employee: any }> {
    return this.http.post<{ success: boolean; customToken: string; employee: any }>(
      this.loginUrl,
      { initData }
    ).pipe(
      map(response => {
        if (!response.success || !response.customToken) {
          throw new Error('Login failed: Invalid response from server');
        }
        return {
          customToken: response.customToken,
          employee: response.employee
        };
      })
    );
  }

  /**
   * Sign in to Firebase with custom token
   * 
   * @param customToken Firebase custom token from backend
   */
  signInWithCustomToken(customToken: string): Observable<User> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth is not initialized');
    }

    return from(signInWithCustomToken(auth, customToken)).pipe(
      map(userCredential => userCredential.user)
    );
  }

  /**
   * Complete authentication flow for Telegram Mini App
   * 1. Get initData from Telegram WebApp
   * 2. Send to backend for verification
   * 3. Get Firebase custom token
   * 4. Sign in to Firebase
   * 
   * @returns Observable<User> Firebase authenticated user
   */
  authenticateTelegramUser(): Observable<User> {
    const initData = this.getTelegramInitData();
    
    if (!initData) {
      throw new Error('Telegram initData not available. Make sure you are running in Telegram Mini App.');
    }

    return this.loginWithTelegram(initData).pipe(
      switchMap(result => this.signInWithCustomToken(result.customToken))
    );
  }

  /**
   * Initialize Telegram WebApp
   * Expands the Mini App to full height and shows main button if needed
   */
  initializeTelegramWebApp(): void {
    const webApp = this.getTelegramWebApp();
    if (webApp) {
      // Expand Mini App to full height
      webApp.expand();
      
      // Enable closing confirmation
      webApp.enableClosingConfirmation();
      
      // Set theme colors (optional)
      // webApp.setHeaderColor('#1976d2');
      // webApp.setBackgroundColor('#ffffff');
      
      console.log('Telegram WebApp initialized');
    }
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
          };
          auth_date?: number;
          hash?: string;
        };
        expand: () => void;
        close: () => void;
        enableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        ready: () => void;
        version: string;
        platform: string;
      };
    };
  }
}
