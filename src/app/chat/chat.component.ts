import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { ChatService } from './chat.service';
import { getFirebaseAuth, getFirebaseApp } from '../firebase.config';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';

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

  messages: Message[] = [
    {
      role: 'assistant',
      content: 'Chào bạn! Tôi là Trợ lý THITHI. Tôi có thể giúp gì cho bạn không?',
      timestamp: new Date()
    }
  ];
  currentMessage: string = '';
  isLoading: boolean = false;
  isRecording: boolean = false;
  isSpeechSupported: boolean = false;
  user: User | null = null;
  isLoadingAuth: boolean = false;
  private shouldScroll: boolean = false;
  private recognition: any = null;
  private baseMessage: string = ''; // Store message before recording starts
  private autoSendTriggered: boolean = false; // Flag to prevent duplicate auto-send
  private silenceTimeout: any = null; // Timeout để tự động dừng khi im lặng

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Check if Speech Recognition is supported
    this.initializeSpeechRecognition();
    // Initialize authentication state listener
    this.initializeAuth();
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
            this.autoSendTriggered = true; // Đánh dấu đã trigger auto-send
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
                this.autoSendTriggered = true;
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
          this.autoSendTriggered = true; // Đánh dấu đã trigger auto-send
          // Gửi ngay lập tức, chỉ đợi một chút để đảm bảo UI đã cập nhật
          setTimeout(() => {
            this.sendMessage();
          }, 100);
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
  }

  sendMessage(): void {
    const message = this.currentMessage.trim();
    if (!message || this.isLoading) {
      return;
    }

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

    // Call API
    this.chatService.sendMessage(message).subscribe({
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
}

