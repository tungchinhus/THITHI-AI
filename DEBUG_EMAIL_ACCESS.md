# 🔍 Debug: Tại sao AI không truy cập email?

## 📊 Phân tích logs

### ✅ Frontend (CONFIRMED)
- **Line 20:** Token được gửi thành công
  - `hasToken: true`
  - `tokenLength: 2652` (hợp lệ)
  - `isTokenValid: true`

### ❓ Backend (CẦN KIỂM TRA)
- **Không có logs từ backend** trong file `.cursor/debug.log`
- **Nguyên nhân có thể:**
  1. `console.log()` trong Firebase Functions ghi vào Firebase logs, không vào file
  2. Backend chưa được deploy với code mới
  3. Backend có lỗi và không chạy đến phần log

## 🔧 Đã cải thiện

### 1. ✅ Cải thiện nhận diện câu hỏi về email
- Thêm keywords: "hợp mail", "hộp thư", "hộp mail", "mail mới", "thư đến", "inbox"
- Thêm normalize để xử lý dấu tiếng Việt
- Câu hỏi "trong hợp mail tôi co mail nào mới không?" sẽ được nhận diện

### 2. ✅ Thêm logging chi tiết
- Backend: `console.log()` để debug (sẽ hiển thị trong Firebase logs)
- Frontend: Log khi gửi token
- Log khi check `isEmailRelatedQuestion`
- Log khi gọi `searchOutlookEmails`
- Log kết quả từ Graph API

### 3. ✅ Cài đặt dependencies
- Package `@microsoft/microsoft-graph-client` đã có trong `package.json`
- Đã chạy `npm install` để cài đặt

## 🧪 Cách kiểm tra

### Option 1: Xem Firebase Functions Logs

```bash
firebase functions:log --only chatFunction
```

Hoặc vào Firebase Console:
1. Vào https://console.firebase.google.com
2. Chọn project: `thithi-3e545`
3. Vào "Functions" > "Logs"
4. Tìm logs với prefix: `📥`, `📧`, `🔍`

### Option 2: Deploy và test

```bash
cd functions
firebase deploy --only functions:chatFunction
```

Sau đó test lại trong app.

## 🔍 Hypotheses

### D: Token không được gửi từ frontend
- **Status:** REJECTED
- **Evidence:** Line 20 shows `hasToken: true`, `tokenLength: 2652`

### E: Backend không nhận được token
- **Status:** INCONCLUSIVE
- **Evidence:** Không có backend logs trong file
- **Action:** Cần xem Firebase Functions logs

### F: Backend không nhận diện được câu hỏi về email
- **Status:** INCONCLUSIVE
- **Evidence:** Đã cải thiện keywords và normalize
- **Action:** Cần test lại với câu hỏi mới

### G: Graph API call thất bại
- **Status:** INCONCLUSIVE
- **Evidence:** Không có logs từ Graph API
- **Action:** Cần xem Firebase Functions logs

### H: Có lỗi khi gọi Graph API
- **Status:** INCONCLUSIVE
- **Evidence:** Không có error logs
- **Action:** Cần xem Firebase Functions logs

## 📝 Next Steps

1. **Deploy function mới:**
   ```bash
   cd functions
   firebase deploy --only functions:chatFunction
   ```

2. **Test lại:**
   - Hỏi: "trong hợp mail tôi co mail nào mới không?"
   - Xem Firebase Functions logs

3. **Kiểm tra logs:**
   - Tìm logs với prefix: `📥 Backend received request`
   - Tìm logs: `📧 Email question check`
   - Tìm logs: `🔍 isEmailRelatedQuestion`
   - Tìm logs: `📡 Graph API response`

## ⚠️ Lưu ý

- Firebase Functions logs không tự động ghi vào `.cursor/debug.log`
- Cần xem logs qua Firebase Console hoặc `firebase functions:log`
- Console.log trong Functions sẽ hiển thị trong Firebase logs

