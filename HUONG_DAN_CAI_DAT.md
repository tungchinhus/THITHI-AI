# Hướng dẫn cài đặt AI Chat Component

## Yêu cầu hệ thống

- Node.js (phiên bản 18 trở lên)
- Angular CLI (phiên bản 17 trở lên)
- npm hoặc yarn

## Bước 1: Tạo dự án Angular mới (nếu chưa có)

```bash
ng new THIHI_AI
cd THIHI_AI
```

## Bước 2: Cài đặt Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

Cập nhật file `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Thêm vào `src/styles.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Bước 3: Cài đặt các thư viện cần thiết

```bash
# Firebase SDK
npm install firebase

# Angular HTTP Client (thường đã có trong Angular)
npm install @angular/common

# Markdown support
npm install ngx-markdown marked

# Forms Module (thường đã có trong Angular)
# Nếu chưa có: npm install @angular/forms
```

## Bước 4: Cấu hình Firebase

1. Tạo file `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  },
  firebaseFunctionUrl: "https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/YOUR_FUNCTION_NAME"
};
```

2. Cập nhật `chat.service.ts` để import Firebase config:

```typescript
import { environment } from '../environments/environment';

// Trong constructor:
if (apps.length === 0) {
  this.firebaseApp = initializeApp(environment.firebaseConfig);
  this.auth = getAuth(this.firebaseApp);
}
```

3. Cập nhật `chat.service.ts` để sử dụng URL từ environment:

```typescript
constructor(private http: HttpClient) {
  this.initializeFirebase();
  this.apiUrl = environment.firebaseFunctionUrl;
}
```

## Bước 5: Cấu hình Angular Module

Nếu bạn đang sử dụng standalone components (như trong code đã cung cấp), đảm bảo:

1. Trong `app.config.ts` hoặc `main.ts`, import `provideHttpClient()`:

```typescript
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // ... other providers
  ]
};
```

2. Nếu sử dụng NgModule, thêm vào `app.module.ts`:

```typescript
import { HttpClientModule } from '@angular/common/http';
import { MarkdownModule } from 'ngx-markdown';

@NgModule({
  imports: [
    HttpClientModule,
    MarkdownModule.forRoot(),
    // ... other imports
  ],
  // ...
})
```

## Bước 6: Sử dụng Component

Thêm component vào `app.component.html`:

```html
<app-chat></app-chat>
```

Hoặc trong routing:

```typescript
{
  path: 'chat',
  component: ChatComponent
}
```

## Bước 7: Cấu hình Firebase Function URL

Trong `chat.component.ts` hoặc `app.component.ts`, set URL cho service:

```typescript
constructor(private chatService: ChatService) {
  this.chatService.setApiUrl('https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/YOUR_FUNCTION_NAME');
}
```

Hoặc tốt hơn, sử dụng environment variable như đã hướng dẫn ở Bước 4.

## Bước 8: Chạy ứng dụng

```bash
ng serve
```

Truy cập `http://localhost:4200` để xem ứng dụng.

## Cấu trúc thư mục

```
src/
├── app/
│   ├── chat/
│   │   ├── chat.component.html
│   │   ├── chat.component.ts
│   │   ├── chat.component.css
│   │   └── chat.service.ts
│   ├── environments/
│   │   └── environment.ts
│   └── ...
├── styles.css
└── ...
```

## Lưu ý quan trọng

1. **Firebase Authentication**: Đảm bảo người dùng đã đăng nhập trước khi sử dụng chat. Component sẽ tự động lấy token từ Firebase Auth.

2. **CORS**: Đảm bảo Firebase Function của bạn đã cấu hình CORS để cho phép requests từ domain của bạn.

3. **API Response Format**: Điều chỉnh parsing response trong `chat.component.ts` dựa trên format thực tế từ Firebase Function của bạn.

4. **Mobile Optimization**: Component đã được tối ưu cho mobile với responsive design sử dụng Tailwind CSS.

5. **Markdown Rendering**: Component sử dụng `ngx-markdown` để render markdown. Đảm bảo cấu hình đúng trong module imports.

## Troubleshooting

### Lỗi: "Cannot find module 'ngx-markdown'"
```bash
npm install ngx-markdown marked
```

### Lỗi: "Firebase not initialized"
- Kiểm tra file `environment.ts` có đúng cấu hình Firebase không
- Đảm bảo đã import và khởi tạo Firebase đúng cách

### Lỗi: "HttpClient not provided"
- Thêm `provideHttpClient()` vào `app.config.ts` hoặc import `HttpClientModule` vào module

### Lỗi CORS
- Cấu hình CORS trong Firebase Function:
```javascript
const cors = require('cors')({ origin: true });
```

