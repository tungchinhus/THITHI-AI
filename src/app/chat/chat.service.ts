import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Auth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase.config';
import { environment } from '../../environments/environment';
import { VectorSearchService, SearchResponse } from '../services/vector-search.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface UserInfo {
  displayName?: string;
  email?: string;
  role?: string; // 'manager' | 'employee' | 'new_employee'
}

export interface ChatRequest {
  question: string;
  microsoftAccessToken?: string; // Optional Microsoft access token for Outlook integration
  chatHistory?: ChatMessage[]; // Lịch sử chat để AI nhớ context
  userInfo?: UserInfo; // Thông tin người dùng để cá nhân hóa
}

export interface ChatResponse {
  answer?: string;
  content?: string;
  message?: string;
  sources?: string[];
  citations?: string[];
  analysis?: string;
  suggestions?: string[];
  vectorSearchResults?: SearchResponse; // Kết quả vector search nếu có
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private auth: Auth | null = null;
  private apiUrl: string = ''; // Set your Firebase Function URL here

  constructor(
    private http: HttpClient,
    private vectorSearchService: VectorSearchService
  ) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    // Don't initialize Auth automatically - only initialize when needed
    // This avoids Identity Toolkit API errors if Auth is not configured
    this.auth = null;
    
    // Set API URL from environment
    if (environment.firebaseFunctionUrl) {
      this.apiUrl = environment.firebaseFunctionUrl;
      
      // Check if URL is still a placeholder
      if (this.apiUrl.includes('YOUR_REGION') || this.apiUrl.includes('YOUR_FUNCTION_NAME')) {
        console.warn('⚠️ Firebase Function URL chưa được cấu hình! Vui lòng cập nhật URL trong environment.ts');
        this.apiUrl = ''; // Disable API calls until URL is configured
      }
    }
  }

  /**
   * Get Firebase Auth Token (lazy initialization)
   */
  private getAuthToken(): Observable<string | null> {
    return new Observable(observer => {
      // Lazy initialize Auth only when needed
      if (!this.auth) {
        try {
          this.auth = getFirebaseAuth();
        } catch (error) {
          console.warn('Firebase Auth not available:', error);
          observer.next(null);
          observer.complete();
          return;
        }
      }

      if (!this.auth) {
        observer.next(null);
        observer.complete();
        return;
      }

      onAuthStateChanged(this.auth, (user) => {
        if (user) {
          user.getIdToken()
            .then(token => {
              observer.next(token);
              observer.complete();
            })
            .catch(error => {
              console.error('Error getting token:', error);
              observer.next(null);
              observer.complete();
            });
        } else {
          observer.next(null);
          observer.complete();
        }
      });
    });
  }

  /**
   * Send message to Firebase Function
   */
  sendMessage(
    question: string, 
    microsoftAccessToken?: string,
    chatHistory?: ChatMessage[],
    userInfo?: UserInfo
  ): Observable<ChatResponse> {
    // Check if API URL is configured
    if (!this.apiUrl || this.apiUrl.trim() === '') {
      console.error('ChatService: API URL is not configured');
      return throwError(() => new Error('Firebase Function URL chưa được cấu hình. Vui lòng cập nhật firebaseFunctionUrl trong environment.ts'));
    }

    console.log('ChatService: Sending message to', this.apiUrl);
    console.log('ChatService: Question:', question);
    if (microsoftAccessToken) {
      console.log('ChatService: Microsoft token provided for Outlook integration');
    }
    if (chatHistory && chatHistory.length > 0) {
      console.log('ChatService: Sending chat history:', chatHistory.length, 'messages');
    }
    if (userInfo) {
      console.log('ChatService: User info:', userInfo);
    }

    // Don't wait for auth token - function doesn't require authentication
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body: ChatRequest = { 
      question,
      ...(microsoftAccessToken && { microsoftAccessToken }),
      ...(chatHistory && chatHistory.length > 0 && { chatHistory }),
      ...(userInfo && { userInfo })
    };

    return this.http.post<ChatResponse>(this.apiUrl, body, { headers }).pipe(
      catchError((error) => {
        console.error('ChatService: API Error:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Set Firebase Function URL
   */
  setApiUrl(url: string): void {
    this.apiUrl = url;
  }

  /**
   * Tìm kiếm với vector similarity (có thể dùng để enhance AI response)
   */
  searchVector(
    query: string,
    tableName: string = 'TSMay',
    topN: number = 5,
    similarityThreshold: number = 0.3
  ): Observable<SearchResponse> {
    return this.vectorSearchService.search(query, tableName, topN, similarityThreshold);
  }

  /**
   * Error handler
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Đã có lỗi xảy ra';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Lỗi: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 0) {
        errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra:\n1. Firebase Function URL đã được cấu hình đúng chưa?\n2. Function đã được deploy chưa?\n3. CORS đã được cấu hình trong Function chưa?';
      } else if (error.status === 404) {
        errorMessage = 'Không tìm thấy Firebase Function. Vui lòng kiểm tra URL trong environment.ts';
      } else if (error.status === 403) {
        errorMessage = 'Không có quyền truy cập. Vui lòng kiểm tra Firebase Auth và CORS settings.';
      } else {
        errorMessage = `Mã lỗi: ${error.status}\nThông báo: ${error.message}`;
      }
    }
    
    console.error('ChatService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}

