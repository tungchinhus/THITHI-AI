import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from './chat/chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChatComponent],
  template: `
    <app-chat></app-chat>
  `,
  styles: [`
    :host { 
      display: block; 
      width: 100%;
      height: 100%;
    }
  `]
})
export class AppComponent {
}
