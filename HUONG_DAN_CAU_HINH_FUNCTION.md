# Hướng dẫn cấu hình Firebase Function URL

## Vấn đề hiện tại

Ứng dụng đang gặp lỗi CORS và 404 vì Firebase Function URL chưa được cấu hình đúng.

## Giải pháp

### Cách 1: Nếu bạn đã có Firebase Function

1. **Lấy URL của Function:**
   - Vào Firebase Console: https://console.firebase.google.com/project/thithi-3e545/functions
   - Tìm Function của bạn và copy URL
   - Format: `https://REGION-PROJECT_ID.cloudfunctions.net/FUNCTION_NAME`
   - Ví dụ: `https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction`

2. **Cập nhật environment files:**
   
   **File: `src/environments/environment.ts`** (cho development):
   ```typescript
   firebaseFunctionUrl: "https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction"
   ```
   
   **File: `src/environments/environment.prod.ts`** (cho production):
   ```typescript
   firebaseFunctionUrl: "https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction"
   ```

3. **Rebuild và deploy:**
   ```bash
   npm run build:prod
   npm run deploy
   ```

### Cách 2: Tạo Firebase Function mới

1. **Khởi tạo Functions (nếu chưa có):**
   ```bash
   firebase init functions
   ```

2. **Function đã được tạo sẵn trong `functions/index.js`**

   Function đã được tạo với đầy đủ:
   - ✅ CORS enabled
   - ✅ Validation input
   - ✅ Error handling
   - ✅ Mock response để test
   
   **File hiện tại:** `functions/index.js`
   
   **Cần làm:** Thay thế phần mock response bằng logic AI thực tế.
   
   Xem file `functions/README.md` để biết cách tích hợp:
   - Google Gemini API
   - OpenAI API  
   - RAG (Retrieval Augmented Generation)

3. **Cài đặt dependencies:**
   
   Dependencies đã được cấu hình sẵn trong `functions/package.json`:
   - `cors` - Xử lý CORS
   - `firebase-admin` - Firebase Admin SDK
   - `firebase-functions` - Firebase Functions SDK
   
   Nếu chưa cài đặt, chạy:
   ```bash
   cd functions
   npm install
   ```
   
   **Lưu ý:** Nếu bạn muốn tích hợp AI service (Gemini, OpenAI), cần cài thêm:
   ```bash
   # Cho Google Gemini
   npm install @google/generative-ai
   
   # Hoặc cho OpenAI
   npm install openai
   ```

4. **Deploy Function:**
   ```bash
   firebase deploy --only functions
   ```

5. **Lấy URL sau khi deploy:**
   - Firebase sẽ hiển thị URL sau khi deploy thành công
   - Format: `https://REGION-thithi-3e545.cloudfunctions.net/chatFunction`
   - Ví dụ: `https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction`
   - Region thường là `us-central1` (mặc định)

6. **Cập nhật environment files:**
   
   Copy URL Function vừa deploy và cập nhật vào 2 file:
   
   **File: `src/environments/environment.ts`** (cho development):
   ```typescript
   firebaseFunctionUrl: "https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction"
   ```
   
   **File: `src/environments/environment.prod.ts`** (cho production):
   ```typescript
   firebaseFunctionUrl: "https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction"
   ```
   
   ⚠️ **Lưu ý:** Thay `us-central1` bằng region thực tế của bạn nếu khác.

7. **Rebuild và deploy lại ứng dụng:**
   ```bash
   npm run build:prod
   npm run deploy
   ```
   
   Hoặc chỉ deploy hosting:
   ```bash
   firebase deploy --only hosting:thithi-ai
   ```

### Cách 3: Tạm thời disable API (để test UI)

Nếu bạn chỉ muốn test giao diện mà chưa có Function:

1. **Cập nhật `chat.service.ts`** để return mock response:
   ```typescript
   sendMessage(question: string): Observable<ChatResponse> {
     // Mock response for testing
     return of({
       answer: `Bạn đã hỏi: "${question}". Đây là phản hồi mẫu để test giao diện.`,
       sources: []
     });
   }
   ```

## Cấu hình CORS trong Firebase Function

Nếu Function đã có nhưng vẫn bị lỗi CORS, đảm bảo Function có cấu hình CORS:

```javascript
const cors = require('cors')({ origin: true });

exports.yourFunction = onRequest((req, res) => {
  cors(req, res, () => {
    // Your function logic here
  });
});
```

Hoặc với v2 functions:
```javascript
const { onRequest } = require('firebase-functions/v2/https');
const cors = require('cors')({ origin: true });

exports.yourFunction = onRequest({
  cors: true, // Enable CORS
}, (req, res) => {
  // Your function logic
});
```

## Kiểm tra Function đã deploy

```bash
firebase functions:list
```

## Lưu ý

- Region thường là `us-central1`, `asia-southeast1`, `europe-west1`, etc.
- Đảm bảo Function đã được deploy trước khi cập nhật URL
- Sau khi cập nhật URL, cần rebuild và deploy lại ứng dụng

