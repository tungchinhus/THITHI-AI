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
  citations?: string[];
  suggestions?: string[];
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
    // KHÔNG load chat history để hiển thị trên UI - chỉ dùng để gửi lên backend
    // Chat history vẫn được lưu và gửi lên backend để AI nhớ context
    // Nhưng UI luôn bắt đầu với welcome message mới
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
    
    if (savedToken) {
      const expiry = savedExpiry ? parseInt(savedExpiry) : null;
      
      // Check if token is expired
      if (expiry && expiry < Date.now()) {
        console.log('Microsoft token expired, clearing...');
        this.clearMicrosoftToken();
        return;
      }
      
      this.microsoftAccessToken = savedToken;
      this.microsoftTokenExpiry = expiry;
      console.log('Microsoft token loaded from localStorage', expiry ? `(expires: ${new Date(expiry).toLocaleString()})` : '');
    } else {
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
    if (!this.microsoftAccessToken) {
      return false;
    }
    
    if (this.microsoftTokenExpiry && this.microsoftTokenExpiry < Date.now()) {
      this.clearMicrosoftToken();
      return false;
    }
    
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

  /**
   * Load chat history from localStorage
   */
  private loadChatHistory(): void {
    try {
      const savedHistory = localStorage.getItem('thihi_chat_history');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Convert timestamp strings back to Date objects
          this.messages = parsed.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
          }));
          console.log('✅ Loaded chat history from localStorage:', this.messages.length, 'messages');
          if (this.messages.length > 0) {
            console.log('📋 History preview:', this.messages.slice(0, 3).map(m => ({ role: m.role, content: m.content.substring(0, 30) })));
          }
          this.shouldScroll = true;
        } else {
          console.log('⚠️ No valid chat history found in localStorage');
        }
      } else {
        console.log('⚠️ No chat history in localStorage');
      }
    } catch (error) {
      console.error('❌ Error loading chat history:', error);
    }
  }

  /**
   * Save chat history to localStorage
   * Lưu tất cả messages (bao gồm cả welcome message) để AI có đầy đủ context
   */
  private saveChatHistory(): void {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:281',message:'saveChatHistory ENTRY',data:{messagesCount:this.messages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    try {
      // Lấy history hiện tại từ localStorage (nếu có)
      let existingHistory: Message[] = [];
      try {
        const saved = localStorage.getItem('thihi_chat_history');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Convert timestamp strings back to Date objects khi load từ localStorage
            existingHistory = parsed.map((msg: any) => ({
              ...msg,
              timestamp: msg.timestamp ? (typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp))) : new Date()
            }));
          }
        }
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:295',message:'localStorage parse error in saveChatHistory',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
      }

      // Merge với messages hiện tại trên UI
      // Tránh duplicate bằng cách so sánh content và timestamp
      const allMessages = [...existingHistory, ...this.messages];
      const uniqueMessages: Message[] = [];
      const seen = new Set<string>();

      for (const msg of allMessages) {
        // Tạo key duy nhất từ role, content và timestamp
        // Đảm bảo timestamp được convert thành number (getTime()) hoặc string
        let timestampValue = '';
        if (msg.timestamp) {
          if (msg.timestamp instanceof Date) {
            timestampValue = msg.timestamp.getTime().toString();
          } else if (typeof msg.timestamp === 'string') {
            // Nếu là string, convert thành Date rồi getTime()
            timestampValue = new Date(msg.timestamp).getTime().toString();
          } else if (typeof msg.timestamp === 'number') {
            timestampValue = String(msg.timestamp);
          } else {
            // Fallback: thử convert
            try {
              const ts = msg.timestamp as any;
              timestampValue = new Date(ts).getTime().toString();
            } catch {
              timestampValue = '';
            }
          }
        }
        
        const key = `${msg.role}_${msg.content.substring(0, 50)}_${timestampValue}`;
        if (!seen.has(key)) {
          seen.add(key);
          // Đảm bảo timestamp là Date object trước khi push
          let normalizedTimestamp: Date;
          if (msg.timestamp instanceof Date) {
            normalizedTimestamp = msg.timestamp;
          } else if (typeof msg.timestamp === 'string') {
            normalizedTimestamp = new Date(msg.timestamp);
          } else if (typeof msg.timestamp === 'number') {
            normalizedTimestamp = new Date(msg.timestamp);
          } else {
            normalizedTimestamp = msg.timestamp ? new Date(msg.timestamp as any) : new Date();
          }
          
          uniqueMessages.push({
            ...msg,
            timestamp: normalizedTimestamp
          });
        }
      }

      // Chỉ lưu tối đa 50 messages gần nhất để tránh localStorage quá lớn
      const messagesToSave = uniqueMessages.slice(-50);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:340',message:'Before saving to localStorage',data:{messagesToSaveCount:messagesToSave.length,uniqueMessagesCount:uniqueMessages.length,allMessagesCount:allMessages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      localStorage.setItem('thihi_chat_history', JSON.stringify(messagesToSave));
      console.log('✅ Saved chat history to localStorage:', messagesToSave.length, 'messages (not displayed on UI)');
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:345',message:'saveChatHistory SUCCESS',data:{savedCount:messagesToSave.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:348',message:'saveChatHistory ERROR',data:{error:String(error),errorType:error instanceof Error ? error.constructor.name : typeof error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error('Error saving chat history:', error);
      // Nếu localStorage đầy, xóa một số messages cũ
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          const reducedMessages = this.messages.slice(-25);
          localStorage.setItem('thihi_chat_history', JSON.stringify(reducedMessages));
          console.log('⚠️ Reduced chat history to 25 messages due to storage limit');
        } catch (e) {
          console.error('Failed to save reduced history:', e);
        }
      }
    }
  }

  /**
   * Clear chat history
   * Xóa cả localStorage và UI messages
   */
  clearChatHistory(): void {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat?\n\nLưu ý: AI sẽ không còn nhớ các cuộc trò chuyện trước đó.')) {
      this.messages = [];
      localStorage.removeItem('thihi_chat_history');
      this.initializeWelcomeMessage();
      console.log('✅ Chat history cleared from both UI and localStorage');
    }
  }

  /**
   * Get user info for personalization
   */
  private getUserInfo(): { displayName?: string; email?: string; role?: string } | undefined {
    if (!this.user) {
      return undefined;
    }

    // Xác định role dựa trên email hoặc displayName
    // Có thể customize logic này dựa trên domain email hoặc pattern
    let role: string | undefined = undefined;
    const email = this.user.email?.toLowerCase() || '';
    const displayName = this.user.displayName?.toLowerCase() || '';

    // Logic đơn giản: nếu có từ "manager", "quản lý", "director" -> manager
    // Nếu có từ "new", "mới" -> new_employee
    // Mặc định -> employee
    if (email.includes('manager') || email.includes('director') || 
        displayName.includes('quản lý') || displayName.includes('manager') ||
        displayName.includes('director') || displayName.includes('giám đốc')) {
      role = 'manager';
    } else if (displayName.includes('new') || displayName.includes('mới') ||
               email.includes('new') || email.includes('intern')) {
      role = 'new_employee';
    } else {
      role = 'employee';
    }

    return {
      displayName: this.user.displayName || undefined,
      email: this.user.email || undefined,
      role
    };
  }

  /**
   * Convert messages to chat history format for API
   * Ưu tiên lấy từ UI messages (session hiện tại), kết hợp với localStorage (sessions trước)
   * Excludes the current user message that is about to be sent
   */
  private getChatHistoryForAPI(): Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }> {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:388',message:'getChatHistoryForAPI ENTRY',data:{messagesCount:this.messages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      // ƯU TIÊN: Lấy từ UI messages (session hiện tại) - đây là messages đang hiển thị
      // Bỏ message cuối cùng (message user vừa thêm vào, đang được gửi)
      const uiMessages = this.messages.length > 1 
        ? this.messages.slice(0, -1)  // Bỏ message cuối (đang gửi)
        : this.messages.filter(msg => msg.role !== 'assistant' || !msg.content.includes('Chào bạn! Tôi là')); // Bỏ welcome message nếu chỉ có 1 message

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:395',message:'UI messages extracted',data:{uiMessagesCount:uiMessages.length,allMessagesCount:this.messages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Lấy từ localStorage (sessions trước) để có context đầy đủ
      let savedHistory: Message[] = [];
      try {
        const saved = localStorage.getItem('thihi_chat_history');
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:400',message:'localStorage check',data:{hasSaved:!!saved,savedLength:saved?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            savedHistory = parsed;
            // #region agent log - Log full saved history content
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:470',message:'Full saved history from localStorage',data:{savedHistoryLength:savedHistory.length,fullSavedHistory:savedHistory.map((msg,idx)=>({index:idx,role:msg.role,content:msg.content,contentLength:msg.content?.length||0})),containsNameInfo:savedHistory.some(m=>m.content?.toLowerCase().includes('tên')||m.content?.toLowerCase().includes('name'))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          }
        }
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:407',message:'localStorage parse error',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }

      // Kết hợp: UI messages (ưu tiên) + localStorage messages (sessions trước)
      // Tránh duplicate bằng cách so sánh content
      const allMessages: Message[] = [];
      const seen = new Set<string>();

      // Thêm UI messages trước (session hiện tại - ưu tiên)
      for (const msg of uiMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const key = `${msg.role}_${msg.content.substring(0, 100)}`;
          if (!seen.has(key)) {
            seen.add(key);
            allMessages.push(msg);
          }
        }
      }

      // Thêm localStorage messages (sessions trước) - chỉ lấy những message chưa có
      for (const msg of savedHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const key = `${msg.role}_${msg.content.substring(0, 100)}`;
          if (!seen.has(key)) {
            seen.add(key);
            allMessages.push(msg);
          }
        }
      }

      // Lấy tối đa 20 messages gần nhất để tránh prompt quá dài
      const recentMessages = allMessages.slice(-20);
      
      // #region agent log - Log final history before conversion
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:510',message:'Final history before conversion',data:{recentMessagesLength:recentMessages.length,uiMessagesCount:uiMessages.length,savedHistoryCount:savedHistory.length,fullRecentMessages:recentMessages.map((msg,idx)=>({index:idx,role:msg.role,content:msg.content,contentLength:msg.content?.length||0})),containsNameInfo:recentMessages.some(m=>m.content?.toLowerCase().includes('tên')||m.content?.toLowerCase().includes('name'))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      const history = recentMessages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp 
          ? (typeof msg.timestamp === 'string' 
              ? msg.timestamp 
              : (msg.timestamp instanceof Date 
                  ? msg.timestamp.toISOString() 
                  : new Date(msg.timestamp).toISOString()))
          : undefined
      }));
      
      // #region agent log - Log final history being sent to API
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:527',message:'Final history being sent to API',data:{historyLength:history.length,fullHistory:history.map((msg,idx)=>({index:idx,role:msg.role,content:msg.content,contentLength:msg.content?.length||0})),containsNameInfo:history.some(m=>m.content?.toLowerCase().includes('tên')||m.content?.toLowerCase().includes('name'))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:535',message:'getChatHistoryForAPI EXIT',data:{historyLength:history.length,uiMessagesCount:uiMessages.filter(m=>m.role==='user'||m.role==='assistant').length,savedHistoryCount:savedHistory.length,recentMessagesCount:recentMessages.length,historyPreview:history.slice(0,3).map(m=>({role:m.role,content:m.content.substring(0,30)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      console.log('📤 Sending chat history:', history.length, 'messages');
      console.log('   - From UI (current session):', uiMessages.filter(m => m.role === 'user' || m.role === 'assistant').length);
      console.log('   - From localStorage (previous sessions):', savedHistory.length);
      if (history.length > 0) {
        console.log('📤 History preview:', history.slice(-5).map(m => ({ 
          role: m.role, 
          content: m.content.substring(0, 40) + '...' 
        })));
      }

      return history;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:460',message:'getChatHistoryForAPI ERROR',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.error('❌ Error getting chat history for API:', error);
      return [];
    }
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
    console.log('=== Google Sign-In Started ===');
    
    // Check Firebase config first
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) {
      console.error('Firebase App is not initialized');
      alert('Firebase chưa được khởi tạo. Vui lòng kiểm tra cấu hình Firebase.\n\nMở Console (F12) để xem chi tiết lỗi.');
      return;
    }
    console.log('Firebase App initialized:', firebaseApp.name);

    const auth = getFirebaseAuth();
    if (!auth) {
      console.error('Firebase Auth is not initialized');
      console.error('Firebase App:', firebaseApp);
      alert('Firebase Auth chưa được khởi tạo. Vui lòng kiểm tra cấu hình Firebase.\n\nMở Console (F12) để xem chi tiết lỗi.');
      return;
    }
    console.log('Firebase Auth initialized:', auth.app.name);
    console.log('Auth domain:', auth.config.authDomain);

    this.isLoadingAuth = true;
    const provider = new GoogleAuthProvider();
    
    // Add additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    console.log('Starting Google sign-in with popup...');
    console.log('Provider:', provider);

    try {
      console.log('Calling signInWithPopup...');
      const result = await signInWithPopup(auth, provider);
      console.log('Sign-in successful via popup');
      console.log('User:', result.user);
      console.log('User email:', result.user.email);
      console.log('User display name:', result.user.displayName);
      // User state will be updated via onAuthStateChanged
    } catch (error: any) {
      console.error('=== Error signing in with Google (popup) ===');
      console.error('Error object:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // If popup is blocked, try redirect instead
      if (error.code === 'auth/popup-blocked') {
        console.log('Popup blocked detected, trying redirect method...');
        const useRedirect = confirm(
          'Popup bị chặn bởi trình duyệt.\n\n' +
          'Bạn có muốn sử dụng phương thức redirect (chuyển hướng) không?\n\n' +
          'Lưu ý: Bạn sẽ được chuyển đến trang đăng nhập của Google và quay lại sau khi đăng nhập.'
        );
        
        if (useRedirect) {
          try {
            console.log('Calling signInWithRedirect...');
            await signInWithRedirect(auth, provider);
            console.log('Redirect initiated, user will be redirected to Google');
            // User will be redirected, so we don't need to do anything else
            // The redirect result will be handled in initializeAuth()
            // Don't set isLoadingAuth to false here as user is being redirected
            return;
          } catch (redirectError: any) {
            console.error('Error with redirect sign-in:', redirectError);
            alert('Không thể chuyển hướng đến trang đăng nhập.\n\nLỗi: ' + (redirectError.message || redirectError.code) + '\n\nMở Console (F12) để xem chi tiết.');
            this.isLoadingAuth = false;
            return;
          }
        } else {
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
      
      alert(errorMessage);
    } finally {
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
      // Normalize redirect URI - remove trailing slash to match Azure AD config
      let redirectUri = window.location.origin + window.location.pathname;
      redirectUri = redirectUri.replace(/\/$/, ''); // Remove trailing slash if exists
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

      // Redirect to Microsoft login (better than popup for cross-origin)
      console.log('Redirecting to Microsoft login...');
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
          console.log('🎤 onend: Auto-sending message, setting lastMessageWasVoice = true');
          this.autoSendTriggered = true; // Đánh dấu đã trigger auto-send
          this.lastMessageWasVoice = true; // Đánh dấu tin nhắn được gửi qua voice
          // Gửi ngay lập tức, chỉ đợi một chút để đảm bảo UI đã cập nhật
          setTimeout(() => {
            this.sendMessage();
          }, 100);
        } else if (!this.autoSendTriggered) {
          // Nếu không tự động gửi (người dùng dừng thủ công), reset flag
          // Để khi họ click Send sau đó, không đọc lại
          console.log('🎤 onend: Not auto-sending, resetting lastMessageWasVoice = false');
          this.lastMessageWasVoice = false;
        } else {
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
    console.log('sendMessage called - wasVoiceMessage:', wasVoiceMessage, 'message:', message.substring(0, 50));
    
    // Reset voice flag after capturing it
    this.lastMessageWasVoice = false;

    // Add user message
    this.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Save chat history after adding user message
    this.saveChatHistory();

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
    
    // Get chat history (exclude current message that was just added)
    const chatHistory = this.getChatHistoryForAPI();
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.component.ts:970',message:'Before sending to API',data:{chatHistoryLength:chatHistory.length,chatHistoryPreview:chatHistory.slice(0,2).map(m=>({role:m.role,content:m.content?.substring(0,30)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Get user info for personalization
    const userInfo = this.getUserInfo();
    
    this.chatService.sendMessage(message, validToken, chatHistory, userInfo).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        // Parse response - Backend đã parse JSON, nhưng đảm bảo xử lý đúng
        // Backend trả về: { answer, citations, suggestions, analysis, sources }
        const aiResponse: Message = {
          role: 'assistant',
          content: response.answer || response.content || response.message || 'Không có phản hồi',
          sources: response.sources || response.citations || [],
          citations: response.citations || response.sources || [],
          suggestions: response.suggestions || [],
          timestamp: new Date()
        };

        // Log để debug
        if (response.suggestions && response.suggestions.length > 0) {
          console.log('✅ Received suggestions:', response.suggestions);
        }
        if (response.citations && response.citations.length > 0) {
          console.log('✅ Received citations:', response.citations);
        }

        this.messages.push(aiResponse);
        this.shouldScroll = true;
        
        // Save chat history after receiving response
        this.saveChatHistory();
        
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
            resolve();
            return;
          }
          
          // Nếu có quá nhiều lỗi liên tiếp, dừng lại
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error('❌ Too many consecutive errors, stopping Google TTS');
            reject(new Error('Too many consecutive errors'));
            return;
          }
          
          const chunk = chunksToPlay[currentIndex];
          const encodedText = encodeURIComponent(chunk);
          // Sử dụng Google Translate TTS API với delay để tránh rate limit
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodedText}`;
          
          
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
            handleError(error);
          });
        };
        
        // Bắt đầu với delay nhỏ để tránh spam ngay từ đầu
        setTimeout(playNext, 200);
      } catch (error) {
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

  /**
   * Handle suggestion click
   */
  handleSuggestionClick(suggestion: string): void {
    if (this.isLoading) {
      return;
    }
    
    // Set suggestion as current message and send
    this.currentMessage = suggestion;
    this.sendMessage();
  }
}

