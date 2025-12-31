# Hướng dẫn Deploy lên Firebase Hosting

## Bước 1: Tạo Project trong Firebase Console

1. Truy cập https://console.firebase.google.com/
2. Tạo project mới hoặc chọn project "thithi-3e545" (nếu đã có)
3. Trong project, vào **Hosting** và tạo site mới với tên **THITHI-AI**

## Bước 2: Cấu hình Firebase CLI

Nếu project ID khác với "thithi-3e545", cập nhật file `.firebaserc`:

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

## Bước 3: Build và Deploy

```bash
# Build ứng dụng
npm run build:prod

# Deploy lên Firebase Hosting với site name THITHI-AI
firebase deploy --only hosting:THITHI-AI
```

Hoặc sử dụng script đã tạo:

```bash
npm run deploy
```

## Lưu ý

- Đảm bảo bạn đã đăng nhập Firebase CLI: `firebase login`
- Đảm bảo site "THITHI-AI" đã được tạo trong Firebase Console
- Nếu gặp lỗi quyền truy cập, kiểm tra lại quyền của tài khoản trong Firebase Console

## URL sau khi deploy

Sau khi deploy thành công, ứng dụng sẽ có sẵn tại:
- `https://THITHI-AI.web.app`
- `https://THITHI-AI.firebaseapp.com`

