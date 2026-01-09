# THIHI AI Chat - Angular Component

Ứng dụng AI Chat nội bộ cho công ty, được thiết kế để nhúng vào Zalo/Telegram Mini App.

## Tính năng

### Giao Diện
- ✅ Giao diện chat giống ChatGPT/Zalo Chat, tối ưu cho mobile
- ✅ Hỗ trợ Markdown (bảng biểu, danh sách từ SQL/PDF)
- ✅ Textarea tự động giãn dòng
- ✅ Typing indicator khi AI đang xử lý
- ✅ Auto-scroll xuống cuối khi có tin nhắn mới

### AI Thông Minh
- ✅ **Nhớ sâu (Deep Memory)**: Nhớ thông tin từ các cuộc trò chuyện trước
- ✅ **Cá nhân hóa**: Điều chỉnh giọng điệu theo vai trò (Sếp/Nhân viên mới/Nhân viên)
- ✅ **Hiểu ngữ cảnh**: Hiểu các đại từ "nó", "cái đó" dựa trên lịch sử chat
- ✅ **Gợi ý thông minh**: Đưa ra suggestions phù hợp sau mỗi câu trả lời
- ✅ **Trả về JSON**: Structured response với analysis, answer, citations, suggestions

### Tích Hợp
- ✅ Tích hợp Firebase Auth để lấy token tự động
- ✅ Tích hợp Microsoft Outlook (đọc email)
- ✅ Tích hợp OneDrive (tìm kiếm file)
- ✅ Hiển thị nguồn tài liệu (Citations)

## Cấu trúc Files

```
src/app/chat/
├── chat.component.html      # Template giao diện
├── chat.component.ts        # Logic component
├── chat.component.css       # Styles tùy chỉnh
└── chat.service.ts          # Service gọi API Firebase

src/environments/
└── environment.ts           # Cấu hình Firebase

HUONG_DAN_CAI_DAT.md        # Hướng dẫn cài đặt
HUONG_DAN_SU_DUNG.md        # Hướng dẫn sử dụng ⭐ MỚI
```

## Quick Start

1. **Cài đặt dependencies:**
```bash
npm install firebase ngx-markdown marked
npm install -D tailwindcss postcss autoprefixer
```

2. **Cấu hình Tailwind CSS:**
```bash
npx tailwindcss init
```

3. **Cập nhật `environment.ts`** với thông tin Firebase của bạn

4. **Sử dụng component:**
```html
<app-chat></app-chat>
```

## Tài Liệu

- 📖 **[HUONG_DAN_SU_DUNG.md](./HUONG_DAN_SU_DUNG.md)** - Hướng dẫn sử dụng chi tiết (⭐ MỚI)
- 🔧 **[HUONG_DAN_CAI_DAT.md](./HUONG_DAN_CAI_DAT.md)** - Hướng dẫn cài đặt
- 📧 **[HUONG_DAN_TICH_HOP_OUTLOOK.md](./HUONG_DAN_TICH_HOP_OUTLOOK.md)** - Tích hợp Outlook
- ⚙️ **[HUONG_DAN_CAU_HINH_FUNCTION.md](./HUONG_DAN_CAU_HINH_FUNCTION.md)** - Cấu hình Function

## API Response Format

Firebase Function trả về JSON với format chuẩn:

```json
{
  "analysis": "Phân tích ngữ cảnh ngắn gọn",
  "answer": "Câu trả lời chi tiết (Markdown format)",
  "citations": ["HD-01.pdf", "Document-02.pdf"],
  "suggestions": [
    "Gợi ý hành động 1",
    "Gợi ý hành động 2",
    "Gợi ý hành động 3"
  ]
}
```

**Lưu ý**: 
- Component tự động parse JSON (kể cả khi bọc trong ```json ... ```)
- Hỗ trợ alias: `sources` = `citations`, `content` = `answer`
- `suggestions` được hiển thị dưới dạng buttons có thể click

Xem **[HUONG_DAN_SU_DUNG.md](./HUONG_DAN_SU_DUNG.md)** để biết chi tiết về cách sử dụng.

## License

Internal use only.

