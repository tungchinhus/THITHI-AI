# THIHI AI Chat - Angular Component

Ứng dụng AI Chat nội bộ cho công ty, được thiết kế để nhúng vào Zalo/Telegram Mini App.

## Tính năng

- ✅ Giao diện chat giống ChatGPT/Zalo Chat, tối ưu cho mobile
- ✅ Hỗ trợ Markdown (bảng biểu, danh sách từ SQL/PDF)
- ✅ Textarea tự động giãn dòng
- ✅ Typing indicator khi AI đang xử lý
- ✅ Tích hợp Firebase Auth để lấy token tự động
- ✅ Auto-scroll xuống cuối khi có tin nhắn mới
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

HUONG_DAN_CAI_DAT.md        # Hướng dẫn chi tiết
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

Xem file `HUONG_DAN_CAI_DAT.md` để biết chi tiết hướng dẫn cài đặt.

## API Response Format

Firebase Function nên trả về JSON với format:

```json
{
  "answer": "Nội dung phản hồi từ AI",
  "sources": ["HD-01.pdf", "Document-02.pdf"]
}
```

Hoặc:

```json
{
  "content": "Nội dung phản hồi từ AI",
  "citations": ["HD-01.pdf"]
}
```

Component sẽ tự động parse các field này.

## License

Internal use only.

