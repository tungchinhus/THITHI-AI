# Hướng Dẫn Sử Dụng THIHI AI Chat

## Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Cài Đặt & Cấu Hình](#cài-đặt--cấu-hình)
3. [Tính Năng Chính](#tính-năng-chính)
4. [Cách Sử Dụng](#cách-sử-dụng)
5. [Ví Dụ Thực Tế](#ví-dụ-thực-tế)
6. [Troubleshooting](#troubleshooting)

---

## Tổng Quan

THIHI AI là một trợ lý AI thông minh nội bộ với các tính năng:
- ✅ **Nhớ sâu (Deep Memory)**: Nhớ thông tin từ các cuộc trò chuyện trước
- ✅ **Cá nhân hóa**: Điều chỉnh giọng điệu theo vai trò người dùng
- ✅ **Hiểu ngữ cảnh**: Hiểu các đại từ như "nó", "cái đó" dựa trên lịch sử chat
- ✅ **Gợi ý thông minh**: Đưa ra suggestions phù hợp sau mỗi câu trả lời
- ✅ **Tích hợp Outlook**: Đọc và tìm kiếm email
- ✅ **Tích hợp OneDrive**: Tìm kiếm và đọc file

---

## Cài Đặt & Cấu Hình

### 1. Cấu Hình Firebase Function

#### Bước 1: Set API Key
```bash
cd functions
firebase functions:secrets:set GEMINI_API_KEY
# Nhập API key khi được hỏi
```

#### Bước 2: Deploy Function
```bash
firebase deploy --only functions:chatFunction
```

#### Bước 3: Lấy Function URL
Sau khi deploy, lấy URL từ Firebase Console hoặc output:
```
https://REGION-PROJECT_ID.cloudfunctions.net/chatFunction
```

### 2. Cấu Hình Frontend

#### Bước 1: Cập nhật Environment
Mở `src/environments/environment.ts`:
```typescript
export const environment = {
  firebaseFunctionUrl: 'https://REGION-PROJECT_ID.cloudfunctions.net/chatFunction',
  microsoftClientId: 'YOUR_MICROSOFT_CLIENT_ID',
  microsoftTenantId: 'YOUR_TENANT_ID' // hoặc 'common'
};
```

#### Bước 2: Build và Deploy
```bash
npm run build
# Deploy dist/ folder lên hosting của bạn
```

### 3. (Tùy chọn) Lưu User Profile trong Firestore

Để bật tính năng cá nhân hóa, tạo collection `users` trong Firestore:

1. Vào Firebase Console → Firestore
2. Tạo collection `users`
3. Tạo document với ID là UID của user
4. Thêm các fields:
   ```json
   {
     "displayName": "Nguyễn Văn A",
     "jobTitle": "Trưởng phòng IT",
     "department": "IT",
     "notes": "Thích demo kỹ thuật"
   }
   ```

**Lưu ý**: Hiện tại hệ thống tự động detect role từ email/displayName. Firestore profile là tùy chọn cho tương lai.

---

## Tính Năng Chính

### 1. Nhớ Sâu (Deep Memory)

AI sẽ nhớ:
- ✅ Thông tin từ các cuộc trò chuyện trước (lưu trong localStorage)
- ✅ Tên, sở thích, yêu cầu của người dùng
- ✅ Context của các câu hỏi trước

**Cách hoạt động**:
- Chat history được lưu tự động vào localStorage
- Mỗi lần gửi message, history được gửi lên backend
- AI đọc history để hiểu context

**Ví dụ**:
```
User: "Tên tôi là CHINH"
AI: "Chào Chinh! Tôi sẽ nhớ tên bạn."
User: "Tôi tên gì?"
AI: "Tên bạn là CHINH" ✅ (Nhớ được!)
```

### 2. Cá Nhân Hóa

AI tự động điều chỉnh giọng điệu dựa trên:
- **Sếp/Quản lý**: Trả lời súc tích, tập trung kết quả, chi phí
- **Nhân viên mới**: Giải thích chi tiết, từng bước
- **Nhân viên**: Trả lời rõ ràng, đầy đủ

**Cách detect role**:
- Từ email: `manager@`, `director@` → Manager
- Từ displayName: "quản lý", "giám đốc" → Manager
- Từ email: `new@`, `intern@` → New Employee
- Mặc định → Employee

### 3. Hiểu Ngữ Cảnh

AI hiểu các đại từ dựa trên lịch sử chat:
- "nó", "cái đó", "như vậy" → Tham khảo lịch sử chat
- "file vừa rồi" → File đã được đề cập trước đó
- "tôi", "bạn" → Dựa trên context

**Ví dụ**:
```
User: "Hạn mức đi SG là bao nhiêu?"
AI: "Hạn mức công tác phí tại TP. Hồ Chí Minh là 2.500.000 VNĐ/ngày"
User: "Còn Hà Nội thì sao?"
AI: "Hạn mức công tác phí tại Hà Nội là 2.000.000 VNĐ/ngày" ✅ (Hiểu "còn" = hỏi tiếp)
```

### 4. Gợi ý Thông Minh

Sau mỗi câu trả lời, AI đưa ra 1-3 suggestions:
- Ngắn gọn (dưới 10 từ)
- Có tính hành động
- Liên quan đến câu hỏi hiện tại

**Ví dụ**:
- Hỏi về "quy trình công tác" → Gợi ý: "Tải mẫu đơn công tác"
- Hỏi về "định mức" → Gợi ý: "Xem bảng định mức các tỉnh"

### 5. Định Dạng JSON Response

AI luôn trả về JSON với cấu trúc:
```json
{
  "analysis": "Phân tích ngữ cảnh ngắn gọn",
  "answer": "Câu trả lời chi tiết (Markdown)",
  "citations": ["File1.pdf", "File2.pdf"],
  "suggestions": [
    "Gợi ý 1",
    "Gợi ý 2",
    "Gợi ý 3"
  ]
}
```

---

## Cách Sử Dụng

### 1. Bắt Đầu Chat

1. Mở ứng dụng
2. Bạn sẽ thấy welcome message từ AI
3. Bắt đầu chat bằng cách gõ câu hỏi

### 2. Sử Dụng Suggestions

- Sau mỗi câu trả lời, bạn sẽ thấy các button gợi ý
- Click vào button để tự động gửi câu hỏi tiếp theo
- Ví dụ: Click "Tải mẫu đơn công tác" → Tự động hỏi về mẫu đơn

### 3. Xem Citations

- Nếu AI tham khảo tài liệu, bạn sẽ thấy phần "Nguồn tham khảo"
- Danh sách các file/tài liệu được sử dụng

### 4. Xóa Lịch Sử Chat

- Click nút "🗑️ Xóa lịch sử" ở header
- Xác nhận để xóa toàn bộ lịch sử
- **Lưu ý**: AI sẽ không còn nhớ các cuộc trò chuyện trước

### 5. Đăng Nhập Microsoft (Tùy chọn)

- Click nút "Outlook" ở header
- Đăng nhập Microsoft để truy cập email
- Sau khi đăng nhập, bạn có thể hỏi về email:
  - "Email mới nhất của tôi là gì?"
  - "Có email nào từ sếp không?"

---

## Ví Dụ Thực Tế

### Ví Dụ 1: Hỏi về Quy Định

**User (Kế toán trưởng)**: "Hạn mức đi SG là bao nhiêu?"

**AI Response**:
```json
{
  "analysis": "User là Kế toán trưởng, cần thông tin chính xác về định mức. 'SG' là TP. Hồ Chí Minh.",
  "answer": "Đối với cấp quản lý, hạn mức công tác phí tại **TP. Hồ Chí Minh** hiện tại là **2.500.000 VNĐ/ngày** (bao gồm phòng nghỉ và phụ cấp lưu trú).\n\nChi tiết xem tại bảng 3.1 quy định tài chính.",
  "citations": ["Quy_dinh_cong_tac_phi_2024.pdf"],
  "suggestions": [
    "Xem chi tiết bảng định mức các tỉnh khác",
    "Tải mẫu tờ trình công tác phí",
    "Quy định về vé máy bay hạng thương gia"
  ]
}
```

**Giải thích**:
- ✅ AI hiểu "SG" = TP. Hồ Chí Minh
- ✅ Trả lời súc tích (vì user là Kế toán trưởng)
- ✅ Có citations và suggestions phù hợp

### Ví Dụ 2: Nhớ Thông Tin

**User**: "Tên tôi là CHINH"
**AI**: "Chào Chinh! Tôi sẽ nhớ tên bạn."

**User**: "Tôi tên gì?"
**AI**: "Tên bạn là CHINH" ✅

**Giải thích**:
- ✅ AI nhớ tên từ câu hỏi trước
- ✅ Không hỏi lại thông tin đã biết

### Ví Dụ 3: Hiểu Đại Từ

**User**: "Hạn mức đi SG là bao nhiêu?"
**AI**: "Hạn mức công tác phí tại TP. Hồ Chí Minh là 2.500.000 VNĐ/ngày"

**User**: "Còn Hà Nội thì sao?"
**AI**: "Hạn mức công tác phí tại Hà Nội là 2.000.000 VNĐ/ngày" ✅

**Giải thích**:
- ✅ AI hiểu "còn" = hỏi tiếp về Hà Nội
- ✅ Dựa trên context của câu hỏi trước

---

## Troubleshooting

### 1. AI Không Nhớ Thông Tin

**Triệu chứng**: AI hỏi lại thông tin đã nói trước đó

**Giải pháp**:
1. Mở Console (F12) và kiểm tra logs:
   - `📤 Sending chat history: X messages` - Phải > 0
   - `✅ Adding chat history to prompt: X messages` - Backend nhận được
2. Kiểm tra localStorage:
   ```javascript
   localStorage.getItem('thihi_chat_history')
   ```
3. Nếu không có history, thử chat lại vài messages

### 2. AI Không Trả Về JSON

**Triệu chứng**: Response là text thường thay vì JSON

**Giải pháp**:
1. Kiểm tra logs backend:
   - `⚠️ AI response không phải JSON format`
   - `⚠️ Lỗi parse JSON response`
2. Kiểm tra prompt có đúng format không
3. Thử hỏi lại với câu hỏi đơn giản hơn

### 3. Suggestions Không Hiển Thị

**Triệu chứng**: Không thấy button suggestions

**Giải pháp**:
1. Kiểm tra Console:
   - `✅ Received suggestions: [...]` - Phải có suggestions
2. Kiểm tra response từ backend có field `suggestions` không
3. Kiểm tra HTML template có bind đúng không

### 4. Citations Không Hiển Thị

**Triệu chứng**: Không thấy phần "Nguồn tham khảo"

**Giải pháp**:
1. Kiểm tra response có field `citations` không
2. Kiểm tra HTML template có hiển thị `message.citations` không
3. Đảm bảo citations là array (không phải null/undefined)

### 5. Lỗi Kết Nối Backend

**Triệu chứng**: "Không thể kết nối đến server"

**Giải pháp**:
1. Kiểm tra `firebaseFunctionUrl` trong `environment.ts`
2. Kiểm tra Function đã được deploy chưa
3. Kiểm tra CORS settings trong Function
4. Kiểm tra network tab trong DevTools

### 6. Microsoft Login Không Hoạt Động

**Triệu chứng**: Không đăng nhập được Microsoft

**Giải pháp**:
1. Kiểm tra `microsoftClientId` và `microsoftTenantId` trong `environment.ts`
2. Kiểm tra Redirect URI trong Azure AD đã đúng chưa
3. Xem file `HUONG_DAN_TICH_HOP_OUTLOOK.md` để biết chi tiết

---

## Best Practices

### 1. Câu Hỏi Rõ Ràng
- ✅ Tốt: "Hạn mức công tác phí tại TP. Hồ Chí Minh là bao nhiêu?"
- ❌ Không tốt: "Hạn mức?"

### 2. Sử Dụng Suggestions
- Click vào suggestions để khám phá thêm thông tin
- Suggestions giúp bạn không cần gõ lại câu hỏi

### 3. Kiểm Tra Citations
- Luôn xem citations để biết nguồn thông tin
- Có thể tải file từ citations để đọc chi tiết

### 4. Xóa Lịch Sử Khi Cần
- Nếu muốn bắt đầu lại từ đầu, xóa lịch sử
- Lịch sử cũ có thể làm AI nhầm lẫn nếu context thay đổi

---

## API Reference

### Request Format

```typescript
POST /chatFunction
Content-Type: application/json

{
  "question": "Câu hỏi của user",
  "microsoftAccessToken": "token...", // Optional
  "chatHistory": [                    // Optional
    {
      "role": "user",
      "content": "Câu hỏi trước",
      "timestamp": "2024-01-09T..."
    }
  ],
  "userInfo": {                       // Optional
    "displayName": "Nguyễn Văn A",
    "email": "user@example.com",
    "role": "manager" // "manager" | "new_employee" | "employee"
  }
}
```

### Response Format

```typescript
{
  "answer": "Câu trả lời chi tiết (Markdown)",
  "citations": ["File1.pdf", "File2.pdf"],
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "analysis": "Phân tích ngữ cảnh", // Optional
  "sources": ["File1.pdf"] // Alias của citations
}
```

---

## Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs trong Console (F12)
2. Kiểm tra Firebase Function logs
3. Xem các file hướng dẫn khác trong project:
   - `HUONG_DAN_TICH_HOP_OUTLOOK.md`
   - `HUONG_DAN_CAU_HINH_FUNCTION.md`
   - `HUONG_DAN_DEBUG_SSO.md`

---

**Phiên bản**: 1.0.0  
**Cập nhật**: 2024-01-09
