import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { ChatService } from './chat.service';

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
      content: 'Chào bạn! Tôi là Trợ lý THIBIDI. Tôi có thể giúp gì cho bạn không? 😊',
      timestamp: new Date()
    }
  ];
  currentMessage: string = '';
  isLoading: boolean = false;
  isRecording: boolean = false;
  isSpeechSupported: boolean = false;
  private shouldScroll: boolean = false;
  private recognition: any = null;
  private baseMessage: string = ''; // Store message before recording starts

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Check if Speech Recognition is supported
    this.initializeSpeechRecognition();
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
        // Store the current message as base before starting recording
        this.baseMessage = this.currentMessage;
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          // Update base message with final transcript
          this.baseMessage = (this.baseMessage + finalTranscript).trim();
          this.currentMessage = this.baseMessage;
          this.adjustTextareaHeight();
        } else if (interimTranscript) {
          // Show base message + interim results
          this.currentMessage = this.baseMessage + interimTranscript;
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
        // Ensure final message is set correctly
        this.currentMessage = this.baseMessage;
        this.adjustTextareaHeight();
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

