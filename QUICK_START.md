# Quick Start Guide - THIHI AI

## 🚀 Bắt Đầu Nhanh

### 1. Cấu Hình Backend (Firebase Function)

```bash
# Set API Key
cd functions
firebase functions:secrets:set GEMINI_API_KEY

# Deploy
firebase deploy --only functions:chatFunction
```

### 2. Cấu Hình Frontend

Cập nhật `src/environments/environment.ts`:
```typescript
export const environment = {
  firebaseFunctionUrl: 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/chatFunction',
  microsoftClientId: 'YOUR_CLIENT_ID', // Optional
  microsoftTenantId: 'common' // Optional
};
```

### 3. Build & Deploy

```bash
npm run build
# Deploy dist/ folder
```

## 📝 Cách Sử Dụng

### Chat Cơ Bản
1. Mở ứng dụng → Thấy welcome message
2. Gõ câu hỏi → Enter hoặc click Send
3. AI trả lời với:
   - ✅ Câu trả lời (Markdown)
   - ✅ Citations (nếu có)
   - ✅ Suggestions (buttons có thể click)

### Sử Dụng Suggestions
- Click vào button suggestions để tự động hỏi tiếp
- Ví dụ: "Tải mẫu đơn công tác" → Tự động gửi câu hỏi

### Xóa Lịch Sử
- Click "🗑️ Xóa lịch sử" ở header
- AI sẽ không còn nhớ các chat trước

## 🎯 Ví Dụ

**User**: "Hạn mức đi SG là bao nhiêu?"

**AI Response**:
- **Answer**: "Đối với cấp quản lý, hạn mức công tác phí tại **TP. Hồ Chí Minh** là **2.500.000 VNĐ/ngày**"
- **Citations**: ["Quy_dinh_cong_tac_phi_2024.pdf"]
- **Suggestions**: 
  - "Xem chi tiết bảng định mức các tỉnh khác"
  - "Tải mẫu tờ trình công tác phí"

## 🔍 Troubleshooting

### AI không nhớ?
- Kiểm tra Console: `📤 Sending chat history: X messages`
- Phải > 0 messages

### Không có suggestions?
- Kiểm tra Console: `✅ Received suggestions: [...]`
- Phải có array suggestions

### Lỗi kết nối?
- Kiểm tra `firebaseFunctionUrl` trong environment.ts
- Kiểm tra Function đã deploy chưa

## 📚 Tài Liệu Đầy Đủ

Xem **[HUONG_DAN_SU_DUNG.md](./HUONG_DAN_SU_DUNG.md)** để biết chi tiết.
