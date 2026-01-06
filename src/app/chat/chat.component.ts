import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { ChatService } from './chat.service';
import { getFirebaseAuth, getFirebaseApp } from '../firebase.config';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { environment } from '../../environments/environment';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp?: Date;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule, DatePipe],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput!: ElementRef;

  botName: string = 'THITHI'; // Bot name, loaded from localStorage
  messages: Message[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;
  isRecording: boolean = false;
  isSpeechSupported: boolean = false;
  user: User | null = null;
  isLoadingAuth: boolean = false;
  microsoftAccessToken: string | null = null; // Microsoft access token for Outlook
  microsoftTokenExpiry: number | null = null; // Token expiration timestamp
  isLoadingMicrosoft: boolean = false; // Loading state for Microsoft login
  private shouldScroll: boolean = false;
  private recognition: any = null;
  private baseMessage: string = ''; // Store message before recording starts
  private autoSendTriggered: boolean = false; // Flag to prevent duplicate auto-send
  private silenceTimeout: any = null; // Timeout để tự động dừng khi im lặng
  private lastMessageWasVoice: boolean = false; // Flag to track if last message was sent via voice
  private speechSynthesis: SpeechSynthesis | null = null; // Text-to-speech API

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Load bot name from localStorage
    this.loadBotName();
    // Load Microsoft access token from localStorage
    this.loadMicrosoftToken();
    // Check for OAuth callback in URL hash
    this.handleMicrosoftCallback();
    // Initialize welcome message with bot name
    this.initializeWelcomeMessage();
    // Check if Speech Recognition is supported
    this.initializeSpeechRecognition();
    // Initialize Text-to-Speech
    this.initializeTextToSpeech();
    // Initialize authentication state listener
    this.initializeAuth();
  }

  /**
   * Load bot name from localStorage or use default
   */
  private loadBotName(): void {
    const savedBotName = localStorage.getItem('thihi_bot_name');
    if (savedBotName) {
      this.botName = savedBotName;
      console.log('Bot name loaded from localStorage:', this.botName);
    } else {
      // Save default name to localStorage
      this.saveBotName();
      console.log('Using default bot name:', this.botName);
    }
  }

  /**
   * Save bot name to localStorage
   */
  private saveBotName(): void {
    localStorage.setItem('thihi_bot_name', this.botName);
    console.log('Bot name saved to localStorage:', this.botName);
  }

  /**
   * Handle Microsoft OAuth callback from URL hash
   */
  private handleMicrosoftCallback(): void {
    // Check if we're returning from Microsoft OAuth
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
      try {
        const params = new URLSearchParams(hash.substring(1)); // Remove '#'
        const accessToken = params.get('access_token');
        const expiresIn = params.get('expires_in');
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        const state = params.get('state');
        const savedState = sessionStorage.getItem('microsoft_oauth_state');

        // Verify state for CSRF protection
        if (state && savedState && state !== savedState) {
          console.error('State mismatch - possible CSRF attack');
          alert('⚠️ Bảo mật: State không khớp. Vui lòng thử lại.');
          sessionStorage.removeItem('microsoft_oauth_state');
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Clean up state
        if (savedState) {
          sessionStorage.removeItem('microsoft_oauth_state');
        }

        if (error) {
          console.error('Microsoft OAuth error:', error, errorDescription);
          let errorMsg = 'Đăng nhập Microsoft thất bại.';
          
          if (error === 'access_denied') {
            errorMsg = 'Bạn đã từ chối cấp quyền. Vui lòng cấp quyền để sử dụng tính năng Outlook.';
          } else if (errorDescription) {
            errorMsg = errorDescription;
          }
          
          alert(`⚠️ ${errorMsg}`);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          this.isLoadingMicrosoft = false;
          return;
        }

        if (accessToken) {
          const expiresInSeconds = expiresIn ? parseInt(expiresIn) : 3600;
          this.saveMicrosoftToken(accessToken, expiresInSeconds);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          this.isLoadingMicrosoft = false;
          console.log('✅ Microsoft token received from callback');
          
          // Show success message
          setTimeout(() => {
            alert('✅ Đăng nhập Microsoft thành công! Bây giờ bạn có thể hỏi về email.');
          }, 100);
        }
      } catch (e) {
        console.error('Error parsing OAuth callback:', e);
        this.isLoadingMicrosoft = false;
        alert('⚠️ Lỗi khi xử lý phản hồi từ Microsoft. Vui lòng thử lại.');
      }
    } else {
      this.isLoadingMicrosoft = false;
    }
  }

  /**
   * Load Microsoft access token from localStorage
   */
  private loadMicrosoftToken(): void {
    const savedToken = localStorage.getItem('thihi_microsoft_token');
    const savedExpiry = localStorage.getItem('thihi_microsoft_token_expiry');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:169',message:'loadMicrosoftToken called',data:{hasSavedToken:!!savedToken,savedTokenLength:savedToken?.length||0,hasSavedExpiry:!!savedExpiry,savedExpiry},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (savedToken) {
      const expiry = savedExpiry ? parseInt(savedExpiry) : null;
      
      // Check if token is expired
      if (expiry && expiry < Date.now()) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:177',message:'Token expired in loadMicrosoftToken',data:{expiry,currentTime:Date.now(),expired:expiry<Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.log('Microsoft token expired, clearing...');
        this.clearMicrosoftToken();
        return;
      }
      
      this.microsoftAccessToken = savedToken;
      this.microsoftTokenExpiry = expiry;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:183',message:'Token loaded successfully',data:{tokenLength:savedToken.length,expiry,expiresAt:expiry?new Date(expiry).toISOString():null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.log('Microsoft token loaded from localStorage', expiry ? `(expires: ${new Date(expiry).toLocaleString()})` : '');
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:187',message:'No token found in localStorage',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  }

  /**
   * Save Microsoft access token to localStorage
   */
  private saveMicrosoftToken(token: string, expiresInSeconds: number = 3600): void {
    const expiry = Date.now() + (expiresInSeconds * 1000);
    
    localStorage.setItem('thihi_microsoft_token', token);
    localStorage.setItem('thihi_microsoft_token_expiry', expiry.toString());
    
    this.microsoftAccessToken = token;
    this.microsoftTokenExpiry = expiry;
    
    console.log('Microsoft token saved to localStorage', `(expires: ${new Date(expiry).toLocaleString()})`);
  }

  /**
   * Clear Microsoft access token
   */
  private clearMicrosoftToken(): void {
    localStorage.removeItem('thihi_microsoft_token');
    localStorage.removeItem('thihi_microsoft_token_expiry');
    
    this.microsoftAccessToken = null;
    this.microsoftTokenExpiry = null;
    
    console.log('Microsoft token cleared');
  }

  /**
   * Check if Microsoft token is valid (not expired)
   */
  isMicrosoftTokenValid(): boolean {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:220',message:'isMicrosoftTokenValid called',data:{hasToken:!!this.microsoftAccessToken,tokenLength:this.microsoftAccessToken?.length||0,hasExpiry:!!this.microsoftTokenExpiry,expiry:this.microsoftTokenExpiry,currentTime:Date.now(),isExpired:this.microsoftTokenExpiry?this.microsoftTokenExpiry<Date.now():null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!this.microsoftAccessToken) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:222',message:'Token validation failed: no token',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return false;
    }
    
    if (this.microsoftTokenExpiry && this.microsoftTokenExpiry < Date.now()) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:225',message:'Token validation failed: expired',data:{expiry:this.microsoftTokenExpiry,currentTime:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      this.clearMicrosoftToken();
      return false;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:229',message:'Token validation passed',data:{tokenLength:this.microsoftAccessToken.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return true;
  }

  /**
   * Initialize welcome message with current bot name
   */
  private initializeWelcomeMessage(): void {
    this.messages = [
      {
        role: 'assistant',
        content: `Chào bạn! Tôi là ${this.botName}. Tôi có thể giúp gì cho bạn không?`,
        timestamp: new Date()
      }
    ];
  }

  private initializeAuth(): void {
    const auth = getFirebaseAuth();
    if (auth) {
      // Check for redirect result (when user comes back from redirect)
      getRedirectResult(auth).then((result) => {
        if (result) {
          console.log('User signed in via redirect:', result.user);
          this.user = result.user;
        }
      }).catch((error) => {
        console.error('Error getting redirect result:', error);
      });

      // Listen to auth state changes
      onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        this.user = user;
      }, (error) => {
        console.error('Auth state change error:', error);
      });
    } else {
      console.error('Firebase Auth is not available');
    }
  }

  async loginWithGoogle(): Promise<void> {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:87',message:'loginWithGoogle called',data:{timestamp:Date.now(),isLoadingAuth:this.isLoadingAuth,user:this.user?this.user.email:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('=== Google Sign-In Started ===');
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:90',message:'Checking Firebase App',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    // Check Firebase config first
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:93',message:'Firebase App not initialized',data:{error:'Firebase App is null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('Firebase App is not initialized');
      alert('Firebase chưa được khởi tạo. Vui lòng kiểm tra cấu hình Firebase.\n\nMở Console (F12) để xem chi tiết lỗi.');
      return;
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:97',message:'Firebase App initialized',data:{appName:firebaseApp.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('Firebase App initialized:', firebaseApp.name);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:99',message:'Getting Firebase Auth',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const auth = getFirebaseAuth();
    if (!auth) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:101',message:'Firebase Auth not initialized',data:{error:'Auth is null',firebaseAppExists:!!firebaseApp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('Firebase Auth is not initialized');
      console.error('Firebase App:', firebaseApp);
      alert('Firebase Auth chưa được khởi tạo. Vui lòng kiểm tra cấu hình Firebase.\n\nMở Console (F12) để xem chi tiết lỗi.');
      return;
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:106',message:'Firebase Auth initialized',data:{authAppName:auth.app.name,authDomain:auth.config.authDomain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log('Firebase Auth initialized:', auth.app.name);
    console.log('Auth domain:', auth.config.authDomain);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:108',message:'Setting loading state and creating provider',data:{beforeLoading:this.isLoadingAuth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    this.isLoadingAuth = true;
    const provider = new GoogleAuthProvider();
    
    // Add additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:118',message:'Before signInWithPopup call',data:{providerCreated:true,isLoadingAuth:this.isLoadingAuth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('Starting Google sign-in with popup...');
    console.log('Provider:', provider);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:121',message:'About to call signInWithPopup',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    try {
      console.log('Calling signInWithPopup...');
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:123',message:'Calling signInWithPopup NOW',data:{timestamp:Date.now(),windowOpenAvailable:typeof window.open==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const result = await signInWithPopup(auth, provider);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:125',message:'signInWithPopup SUCCESS',data:{userEmail:result.user.email,userDisplayName:result.user.displayName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.log('Sign-in successful via popup');
      console.log('User:', result.user);
      console.log('User email:', result.user.email);
      console.log('User display name:', result.user.displayName);
      // User state will be updated via onAuthStateChanged
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:130',message:'signInWithPopup ERROR caught',data:{errorCode:error.code,errorMessage:error.message,errorName:error.name,hasStack:!!error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('=== Error signing in with Google (popup) ===');
      console.error('Error object:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:137',message:'Checking error code',data:{errorCode:error.code,isPopupBlocked:error.code==='auth/popup-blocked'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // If popup is blocked, try redirect instead
      if (error.code === 'auth/popup-blocked') {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:139',message:'Popup blocked confirmed',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log('Popup blocked detected, trying redirect method...');
        const useRedirect = confirm(
          'Popup bị chặn bởi trình duyệt.\n\n' +
          'Bạn có muốn sử dụng phương thức redirect (chuyển hướng) không?\n\n' +
          'Lưu ý: Bạn sẽ được chuyển đến trang đăng nhập của Google và quay lại sau khi đăng nhập.'
        );
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:147',message:'User redirect choice',data:{useRedirect:useRedirect},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        if (useRedirect) {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:150',message:'Calling signInWithRedirect',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.log('Calling signInWithRedirect...');
            await signInWithRedirect(auth, provider);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:152',message:'Redirect initiated successfully',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.log('Redirect initiated, user will be redirected to Google');
            // User will be redirected, so we don't need to do anything else
            // The redirect result will be handled in initializeAuth()
            // Don't set isLoadingAuth to false here as user is being redirected
            return;
          } catch (redirectError: any) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:155',message:'Redirect error',data:{redirectErrorCode:redirectError.code,redirectErrorMessage:redirectError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.error('Error with redirect sign-in:', redirectError);
            alert('Không thể chuyển hướng đến trang đăng nhập.\n\nLỗi: ' + (redirectError.message || redirectError.code) + '\n\nMở Console (F12) để xem chi tiết.');
            this.isLoadingAuth = false;
            return;
          }
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:161',message:'User declined redirect',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          alert('Vui lòng cho phép popup trong trình duyệt và thử lại.\n\nCách cho phép popup:\n1. Click vào icon khóa/ảnh ở thanh địa chỉ\n2. Cho phép popup cho trang này\n3. Thử lại');
          this.isLoadingAuth = false;
          return;
        }
      }
      
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Đăng nhập bị hủy. Vui lòng thử lại.';
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = '⚠️ Google Sign-In chưa được cấu hình đúng cách.\n\n' +
          'Vui lòng làm theo các bước sau:\n\n' +
          'BƯỚC 1: Bật Google Sign-In trong Firebase Console\n' +
          '1. Vào https://console.firebase.google.com/\n' +
          '2. Chọn project: thithi-3e545\n' +
          '3. Vào Authentication > Sign-in method\n' +
          '4. Tìm "Google" trong danh sách providers\n' +
          '5. Click vào "Google" và bật nó (Enable)\n' +
          '6. Nhập "Project support email" (email hỗ trợ dự án)\n' +
          '7. Click "Save"\n\n' +
          'BƯỚC 2: Bật Identity Toolkit API trong Google Cloud Console\n' +
          '1. Vào https://console.cloud.google.com/\n' +
          '2. Chọn project: thithi-3e545\n' +
          '3. Vào "APIs & Services" > "Library"\n' +
          '4. Tìm "Identity Toolkit API"\n' +
          '5. Click vào và bấm "Enable"\n\n' +
          'Sau khi hoàn thành cả 2 bước, đợi 1-2 phút rồi refresh trang và thử lại.\n\n' +
          'Xem file HUONG_DAN_DEBUG_SSO.md để biết chi tiết.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'Domain chưa được cấu hình trong Firebase Console.\n\nVui lòng:\n1. Vào Firebase Console\n2. Authentication > Settings > Authorized domains\n3. Thêm domain của bạn\n\nXem file HUONG_DAN_DEBUG_SSO.md để biết chi tiết.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google Sign-In chưa được bật trong Firebase Console.\n\nVui lòng:\n1. Vào Firebase Console\n2. Authentication > Sign-in method\n3. Bật Google provider\n\nXem file HUONG_DAN_DEBUG_SSO.md để biết chi tiết.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.';
      } else {
        errorMessage = `Lỗi: ${error.message || error.code}\n\nMở Console (F12) để xem chi tiết.\n\nXem file HUONG_DAN_DEBUG_SSO.md để biết cách debug.`;
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:181',message:'Showing error alert',data:{errorMessage:errorMessage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      alert(errorMessage);
    } finally {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:184',message:'Finally block',data:{isLoadingAuth:this.isLoadingAuth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Only set to false if not redirecting
      if (this.isLoadingAuth) {
        this.isLoadingAuth = false;
      }
    }
  }

  async logout(): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Đăng xuất thất bại. Vui lòng thử lại.');
    }
  }

  /**
   * Login with Microsoft to access Outlook
   * Uses environment variables for Client ID and Tenant ID
   * Uses redirect flow (better than popup for cross-origin)
   */
  async loginWithMicrosoft(): Promise<void> {
    // Check if already logged in with valid token
    if (this.isMicrosoftTokenValid()) {
      alert('✅ Bạn đã đăng nhập Microsoft. Token còn hiệu lực đến ' + 
            (this.microsoftTokenExpiry ? new Date(this.microsoftTokenExpiry).toLocaleString('vi-VN') : 'không xác định'));
      return;
    }

    const MICROSOFT_CLIENT_ID = environment.microsoftClientId;
    const MICROSOFT_TENANT_ID = environment.microsoftTenantId || 'common';
    
    if (!MICROSOFT_CLIENT_ID || MICROSOFT_CLIENT_ID === '') {
      alert('⚠️ Microsoft Client ID chưa được cấu hình.\n\nVui lòng:\n1. Cập nhật microsoftClientId trong src/environments/environment.ts\n2. Xem file HUONG_DAN_TICH_HOP_OUTLOOK.md để biết chi tiết.');
      return;
    }

    this.isLoadingMicrosoft = true;

    try {
      // Use current URL as redirect URI (works for both localhost and production)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:498',message:'Before redirect URI construction',data:{origin:window.location.origin,pathname:window.location.pathname,fullUrl:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Normalize redirect URI - remove trailing slash to match Azure AD config
      let redirectUri = window.location.origin + window.location.pathname;
      redirectUri = redirectUri.replace(/\/$/, ''); // Remove trailing slash if exists
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:501',message:'Redirect URI normalized',data:{redirectUri,hasTrailingSlash:redirectUri.endsWith('/'),length:redirectUri.length,originalPathname:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const scopes = ['User.Read', 'Mail.Read', 'Mail.ReadBasic', 'Files.Read', 'Files.Read.All', 'Sites.Read.All', 'offline_access'].join(' ');
      
      // Generate state for CSRF protection
      const state = Date.now().toString() + Math.random().toString(36).substring(7);
      sessionStorage.setItem('microsoft_oauth_state', state);
      
      // Microsoft OAuth2 authorization URL
      const authUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?` +
        `client_id=${encodeURIComponent(MICROSOFT_CLIENT_ID)}` +
        `&response_type=token` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_mode=fragment` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${encodeURIComponent(state)}` +
        `&prompt=select_account`; // Force account selection

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:515',message:'Auth URL constructed',data:{redirectUri,encodedRedirectUri:encodeURIComponent(redirectUri),authUrlLength:authUrl.length,tenantId:MICROSOFT_TENANT_ID,clientId:MICROSOFT_CLIENT_ID.substring(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Redirect to Microsoft login (better than popup for cross-origin)
      console.log('Redirecting to Microsoft login...');
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:518',message:'About to redirect',data:{redirectUri},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      window.location.href = authUrl;
    } catch (error) {
      this.isLoadingMicrosoft = false;
      console.error('Error initiating Microsoft login:', error);
      alert('⚠️ Lỗi khi khởi tạo đăng nhập Microsoft. Vui lòng thử lại.');
    }
  }

  /**
   * Logout from Microsoft (clear token)
   */
  logoutMicrosoft(): void {
    this.clearMicrosoftToken();
    alert('Đã đăng xuất Microsoft.');
  }

  private initializeTextToSpeech(): void {
    // Check if Speech Synthesis is supported
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
      console.log('Text-to-Speech is supported');
      
      // Preload voices by calling getVoices() early
      // Some browsers need this to trigger voices loading
      if (this.speechSynthesis.getVoices().length === 0) {
        // Listen for voices to be loaded
        this.speechSynthesis.addEventListener('voiceschanged', () => {
          const voices = this.speechSynthesis!.getVoices();
          console.log('Voices loaded:', voices.length);
          const vietnameseVoices = voices.filter(voice => 
            voice.lang.startsWith('vi') || 
            voice.name.toLowerCase().includes('vietnamese') ||
            voice.name.toLowerCase().includes('viet nam')
          );
          if (vietnameseVoices.length > 0) {
            console.log('Vietnamese voices found:', vietnameseVoices.map(v => v.name));
          } else {
            console.log('No Vietnamese voices found, will use default voice');
          }
        }, { once: true });
      } else {
        const voices = this.speechSynthesis.getVoices();
        console.log('Voices already loaded:', voices.length);
      }
    } else {
      console.warn('Text-to-Speech API is not supported in this browser');
    }
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.isSpeechSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'vi-VN'; // Vietnamese language

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.autoSendTriggered = false; // Reset flag when starting recording
        // Store the current message as base before starting recording
        this.baseMessage = this.currentMessage || '';
        // Đảm bảo textarea hiển thị ngay khi bắt đầu
        this.adjustTextareaHeight();
        // Clear any existing timeout
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        let allFinal = true;

        // Xử lý tất cả kết quả từ resultIndex đến cuối
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // Kết quả cuối cùng - thêm vào baseMessage
            finalTranscript += transcript + ' ';
          } else {
            // Kết quả tạm thời - hiển thị ngay
            interimTranscript += transcript;
            allFinal = false;
          }
        }

        // Nếu có final transcript, cập nhật baseMessage
        if (finalTranscript) {
          this.baseMessage = (this.baseMessage + finalTranscript).trim();
        }
        
        // Luôn cập nhật currentMessage để hiển thị
        if (interimTranscript) {
          // Có interim - hiển thị base + interim
          this.currentMessage = (this.baseMessage + ' ' + interimTranscript).trim();
        } else if (finalTranscript) {
          // Chỉ có final - hiển thị base (đã bao gồm final)
          this.currentMessage = this.baseMessage;
        }
        
        // Luôn gọi adjustTextareaHeight để đảm bảo UI cập nhật
        if (finalTranscript || interimTranscript) {
          this.adjustTextareaHeight();
        }

        // Reset silence timeout mỗi khi có kết quả mới
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }

        // Nếu có final transcript (đã nhận diện xong một phần), tự động dừng và gửi ngay
        if (finalTranscript && !this.isLoading && !this.autoSendTriggered) {
          const messageToSend = this.currentMessage?.trim() || this.baseMessage?.trim();
          if (messageToSend) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:398',message:'Setting lastMessageWasVoice=true for final transcript',data:{messageToSend:messageToSend.substring(0,50),finalTranscript,interimTranscript},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            console.log('🎤 Final transcript received, setting lastMessageWasVoice = true');
            this.autoSendTriggered = true; // Đánh dấu đã trigger auto-send
            this.lastMessageWasVoice = true; // Đánh dấu tin nhắn được gửi qua voice
            // Dừng recognition ngay lập tức
            if (this.recognition && this.isRecording) {
              this.recognition.stop();
            }
            // Gửi ngay lập tức khi có final transcript
            setTimeout(() => {
              this.sendMessage();
            }, 100);
          }
        } else if (interimTranscript && !this.autoSendTriggered) {
          // Nếu chỉ có interim transcript (đang nói), đặt timeout để tự động dừng sau khi im lặng
          this.silenceTimeout = setTimeout(() => {
            if (this.isRecording && this.recognition && !this.autoSendTriggered) {
              const messageToSend = this.currentMessage?.trim() || this.baseMessage?.trim();
              if (messageToSend) {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:418',message:'Setting lastMessageWasVoice=true for silence timeout',data:{messageToSend:messageToSend.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                console.log('🎤 Silence timeout, setting lastMessageWasVoice = true');
                this.autoSendTriggered = true;
                this.lastMessageWasVoice = true; // Đánh dấu tin nhắn được gửi qua voice
                this.recognition.stop();
                setTimeout(() => {
                  this.sendMessage();
                }, 100);
              }
            }
          }, 1500); // Tự động dừng sau 1.5 giây im lặng
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.isRecording = false;
        
        let errorMessage = 'Lỗi nhận diện giọng nói';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'Không phát hiện giọng nói. Vui lòng thử lại.';
            break;
          case 'audio-capture':
            errorMessage = 'Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.';
            break;
          case 'not-allowed':
            errorMessage = 'Quyền truy cập microphone bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.';
            break;
        }
        
        // Optionally show error message to user
        if (event.error !== 'no-speech') {
          alert(errorMessage);
        }
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        
        // Clear silence timeout
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }
        
        // Đảm bảo text cuối cùng được hiển thị
        // Nếu baseMessage rỗng nhưng có currentMessage, dùng currentMessage
        if (!this.baseMessage && this.currentMessage) {
          this.baseMessage = this.currentMessage;
        }
        
        // Đảm bảo currentMessage được set đúng
        this.currentMessage = this.baseMessage || this.currentMessage;
        this.adjustTextareaHeight();
        
        // Tự động gửi tin nhắn ngay lập tức nếu có nội dung sau khi dừng ghi âm
        // Chỉ gửi nếu chưa được gửi tự động trong onresult
        const messageToSend = this.currentMessage?.trim() || this.baseMessage?.trim();
        if (messageToSend && !this.isLoading && !this.autoSendTriggered) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:433',message:'Setting lastMessageWasVoice=true in onend',data:{messageToSend:messageToSend.substring(0,50),isLoading:this.isLoading,autoSendTriggered:this.autoSendTriggered},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.log('🎤 onend: Auto-sending message, setting lastMessageWasVoice = true');
          this.autoSendTriggered = true; // Đánh dấu đã trigger auto-send
          this.lastMessageWasVoice = true; // Đánh dấu tin nhắn được gửi qua voice
          // Gửi ngay lập tức, chỉ đợi một chút để đảm bảo UI đã cập nhật
          setTimeout(() => {
            this.sendMessage();
          }, 100);
        } else if (!this.autoSendTriggered) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:442',message:'Resetting lastMessageWasVoice=false in onend (manual stop)',data:{messageToSend:messageToSend?.substring(0,50),isLoading:this.isLoading,autoSendTriggered:this.autoSendTriggered},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // Nếu không tự động gửi (người dùng dừng thủ công), reset flag
          // Để khi họ click Send sau đó, không đọc lại
          console.log('🎤 onend: Not auto-sending, resetting lastMessageWasVoice = false');
          this.lastMessageWasVoice = false;
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:497',message:'onend: autoSendTriggered=true, keeping lastMessageWasVoice flag',data:{lastMessageWasVoice:this.lastMessageWasVoice,autoSendTriggered:this.autoSendTriggered},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // Nếu autoSendTriggered=true, nghĩa là đã gửi qua voice trong onresult
          // Giữ nguyên flag để sendMessage() có thể đọc lại phản hồi
          console.log('🎤 onend: autoSendTriggered=true, keeping lastMessageWasVoice =', this.lastMessageWasVoice);
        }
      };
    } else {
      this.isSpeechSupported = false;
      console.warn('Speech Recognition API is not supported in this browser');
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
    // Auto-resize AI message textareas
    this.adjustAITextareaHeights();
  }

  private adjustAITextareaHeights(): void {
    // Tìm tất cả textarea readonly (AI messages) và auto-resize
    const aiTextareas = document.querySelectorAll('textarea[readonly]');
    aiTextareas.forEach((textarea: any) => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
  }

  ngOnDestroy(): void {
    // Stop recording if active
    if (this.isRecording && this.recognition) {
      this.recognition.stop();
    }
    
    // Stop text-to-speech if active
    this.stopSpeaking();
    
    // Clear any pending timeouts
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  sendMessage(): void {
    const message = this.currentMessage.trim();
    if (!message || this.isLoading) {
      return;
    }

    // Track if this message was sent via voice (before resetting the flag)
    const wasVoiceMessage = this.lastMessageWasVoice;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:536',message:'sendMessage called',data:{wasVoiceMessage,message:message.substring(0,50),lastMessageWasVoice:this.lastMessageWasVoice},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('sendMessage called - wasVoiceMessage:', wasVoiceMessage, 'message:', message.substring(0, 50));
    
    // Reset voice flag after capturing it
    this.lastMessageWasVoice = false;

    // Add user message
    this.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    this.currentMessage = '';
    this.adjustTextareaHeight();
    this.shouldScroll = true;
    this.isLoading = true;

    // Check if Microsoft token is still valid before sending
    if (this.microsoftAccessToken && !this.isMicrosoftTokenValid()) {
      console.warn('Microsoft token expired, clearing...');
      this.clearMicrosoftToken();
    }

    // Call API with Microsoft token if available and valid
    const validToken = this.isMicrosoftTokenValid() && this.microsoftAccessToken ? this.microsoftAccessToken : undefined;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:810',message:'Sending message to backend',data:{message:message.substring(0,50),hasToken:!!validToken,tokenLength:validToken?.length||0,isTokenValid:this.isMicrosoftTokenValid()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    this.chatService.sendMessage(message, validToken).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        // Parse response - adjust based on your API response structure
        const aiResponse: Message = {
          role: 'assistant',
          content: response.answer || response.content || response.message || 'Không có phản hồi',
          sources: response.sources || response.citations || [],
          timestamp: new Date()
        };

        this.messages.push(aiResponse);
        this.shouldScroll = true;
        
        // Text-to-speech đã được tắt
        // if (wasVoiceMessage) {
        //   this.speak(aiResponse.content);
        // }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error sending message:', error);
        
        let errorMessage = 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.';
        
        // Provide more specific error messages
        if (error.message) {
          if (error.message.includes('chưa được cấu hình')) {
            errorMessage = '⚠️ Firebase Function URL chưa được cấu hình.\n\nVui lòng:\n1. Mở file src/environments/environment.ts\n2. Cập nhật firebaseFunctionUrl với URL Function của bạn\n3. Rebuild và deploy lại ứng dụng\n\nXem file HUONG_DAN_CAU_HINH_FUNCTION.md để biết chi tiết.';
          } else if (error.message.includes('CORS') || error.message.includes('kết nối')) {
            errorMessage = '⚠️ Không thể kết nối đến server.\n\nVui lòng kiểm tra:\n1. Firebase Function URL đã đúng chưa?\n2. Function đã được deploy chưa?\n3. CORS đã được cấu hình trong Function chưa?';
          } else if (error.message.includes('404')) {
            errorMessage = '⚠️ Không tìm thấy Firebase Function.\n\nVui lòng kiểm tra URL trong environment.ts và đảm bảo Function đã được deploy.';
          } else {
            errorMessage = `⚠️ Lỗi: ${error.message}`;
          }
        }
        
        this.messages.push({
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date()
        });
        this.shouldScroll = true;
      }
    });
  }

  onEnterKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.sendMessage();
    }
  }

  adjustTextareaHeight(): void {
    if (this.messageInput?.nativeElement) {
      const textarea = this.messageInput.nativeElement;
      textarea.style.height = 'auto';
      // Giới hạn max-height 120px
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }

  scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  toggleRecording(): void {
    if (!this.isSpeechSupported) {
      alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome, Edge hoặc Safari.');
      return;
    }

    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  startRecording(): void {
    if (!this.recognition) {
      return;
    }

    // Unlock speech synthesis by calling speak with a very short text
    // This is required by some browsers to allow speech synthesis
    // Must be done in response to user interaction (click)
    if (this.speechSynthesis) {
      try {
        console.log('🔓 Unlocking speech synthesis...');
        // Thử unlock bằng cách gọi speak với text rất ngắn và volume = 0
        const unlockUtterance = new SpeechSynthesisUtterance(' ');
        unlockUtterance.volume = 0;
        unlockUtterance.rate = 10; // Rất nhanh để không nghe thấy
        unlockUtterance.onstart = () => {
          console.log('✅ Speech synthesis unlocked successfully');
          this.speechSynthesis!.cancel();
        };
        unlockUtterance.onerror = (event) => {
          console.warn('⚠️ Unlock attempt error (may be normal):', event);
        };
        this.speechSynthesis.speak(unlockUtterance);
        // Cancel ngay sau khi unlock
        setTimeout(() => {
          if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
          }
        }, 10);
      } catch (error) {
        console.warn('⚠️ Failed to unlock speech synthesis:', error);
      }
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      // If already started, stop and restart
      if (this.isRecording) {
        this.recognition.stop();
        setTimeout(() => {
          this.recognition.start();
        }, 100);
      }
    }
  }

  stopRecording(): void {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
  }

  /**
   * Đọc text bằng Google Translate TTS (giọng tiếng Việt tự nhiên)
   * ĐÃ TẮT - Không sử dụng nữa
   */
  private speakWithGoogleTTS(text: string): Promise<void> {
    // Function disabled
    return Promise.reject(new Error('Google TTS is disabled'));
    return new Promise((resolve, reject) => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:746',message:'speakWithGoogleTTS called',data:{textLength:text.length,textPreview:text.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        console.log('🔊 Using Google Translate TTS for Vietnamese voice');
        
        // Chia text thành các đoạn nhỏ hơn để giảm số lượng requests
        // Google TTS có giới hạn ~200 ký tự, nhưng để an toàn dùng 150
        const maxLength = 150;
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let currentChunk = '';
        const chunks: string[] = [];
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxLength) {
            currentChunk += sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        
        // Nếu vẫn quá dài, chia theo từ
        const finalChunks: string[] = [];
        for (const chunk of chunks) {
          if (chunk.length <= maxLength) {
            finalChunks.push(chunk);
          } else {
            const words = chunk.split(' ');
            let current = '';
            for (const word of words) {
              if ((current + ' ' + word).length <= maxLength) {
                current = current ? current + ' ' + word : word;
              } else {
                if (current) finalChunks.push(current);
                current = word;
              }
            }
            if (current) finalChunks.push(current);
          }
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:775',message:'Text chunks prepared for Google TTS',data:{totalChunks:finalChunks.length,chunkLengths:finalChunks.map(c=>c.length)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // Nếu có quá nhiều chunks, giới hạn để tránh spam requests
        const maxChunks = 10;
        const chunksToPlay = finalChunks.slice(0, maxChunks);
        if (finalChunks.length > maxChunks) {
          console.warn(`⚠️ Text too long, limiting to ${maxChunks} chunks`);
        }
        
        let currentIndex = 0;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3;
        
        const playNext = () => {
          if (currentIndex >= chunksToPlay.length) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:800',message:'All Google TTS chunks played',data:{totalChunks:chunksToPlay.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            resolve();
            return;
          }
          
          // Nếu có quá nhiều lỗi liên tiếp, dừng lại
          if (consecutiveErrors >= maxConsecutiveErrors) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:806',message:'Too many consecutive errors, stopping Google TTS',data:{consecutiveErrors,currentIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            console.error('❌ Too many consecutive errors, stopping Google TTS');
            reject(new Error('Too many consecutive errors'));
            return;
          }
          
          const chunk = chunksToPlay[currentIndex];
          const encodedText = encodeURIComponent(chunk);
          // Sử dụng Google Translate TTS API với delay để tránh rate limit
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodedText}`;
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:815',message:'Playing Google TTS chunk',data:{chunkIndex:currentIndex,totalChunks:chunksToPlay.length,chunkLength:chunk.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          const audio = new Audio(url);
          let hasEnded = false;
          let hasError = false;
          
          const handleEnd = () => {
            if (hasEnded) return;
            hasEnded = true;
            consecutiveErrors = 0; // Reset error counter on success
            currentIndex++;
            // Tăng delay giữa các chunk để tránh rate limit (500ms)
            setTimeout(playNext, 500);
          };
          
          const handleError = (error: any) => {
            if (hasError) return;
            hasError = true;
            consecutiveErrors++;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:833',message:'Google TTS chunk error',data:{chunkIndex:currentIndex,consecutiveErrors,error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            console.error(`Error playing Google TTS chunk (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
            
            // Nếu chưa đạt max errors, thử chunk tiếp theo
            if (consecutiveErrors < maxConsecutiveErrors) {
              currentIndex++;
              setTimeout(playNext, 1000); // Delay lâu hơn khi có lỗi
            } else {
              reject(new Error('Too many consecutive errors'));
            }
          };
          
          audio.onended = handleEnd;
          audio.onerror = handleError;
          
          audio.play().catch((error) => {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:848',message:'Google TTS play() error',data:{chunkIndex:currentIndex,error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            handleError(error);
          });
        };
        
        // Bắt đầu với delay nhỏ để tránh spam ngay từ đầu
        setTimeout(playNext, 200);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:855',message:'speakWithGoogleTTS error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        console.error('Error in speakWithGoogleTTS:', error);
        reject(error);
      }
    });
  }

  /**
   * Đọc text bằng giọng nói (Text-to-Speech)
   * ĐÃ TẮT - Không sử dụng nữa
   */
  speak(text: string): void {
    // Function disabled - text-to-speech is turned off
    return;
  }

  /**
   * Dừng đọc giọng nói
   */
  stopSpeaking(): void {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
      console.log('🔇 Speech cancelled');
    }
  }

  /**
   * Test speech synthesis (for debugging)
   * Có thể gọi từ console: ng.profiler.timeEnd('test')
   */
  testSpeech(): void {
    console.log('🧪 Testing speech synthesis...');
    const testText = 'Xin chào, đây là bài test giọng nói.';
    this.speak(testText);
  }
}

