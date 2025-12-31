# Hướng dẫn Deploy Firebase Function

## Vấn đề hiện tại

Function đã được tạo nhưng chưa deploy thành công. Hãy làm theo các bước sau:

## Bước 1: Deploy Function

Chạy lệnh sau để deploy Function:

```bash
cd c:\MyData\projects\THIHI_AI
firebase deploy --only functions
```

Hoặc deploy từng function:

```bash
firebase deploy --only functions:chatFunction
firebase deploy --only functions:healthCheck
```

## Bước 2: Lấy URL sau khi deploy

Sau khi deploy thành công, Firebase sẽ hiển thị URL của Function. Format sẽ là:

```
https://REGION-PROJECT_ID.cloudfunctions.net/FUNCTION_NAME
```

Ví dụ:
- `https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction`
- `https://us-central1-thithi-3e545.cloudfunctions.net/healthCheck`

## Bước 3: Cập nhật Environment

Sau khi có URL, cập nhật các file:

**File: `src/environments/environment.ts`** (development):
```typescript
firebaseFunctionUrl: "https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction"
```

**File: `src/environments/environment.prod.ts`** (production):
```typescript
firebaseFunctionUrl: "https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction"
```

## Bước 4: Rebuild và Deploy lại ứng dụng

```bash
npm run build:prod
npm run deploy
```

## Kiểm tra Function đã deploy

```bash
firebase functions:list
```

## Test Function

Sau khi deploy, bạn có thể test Function bằng cách:

1. **Test qua browser:**
   - Mở: `https://us-central1-thithi-3e545.cloudfunctions.net/healthCheck`
   - Nếu thấy `{"status":"ok",...}` thì Function đã hoạt động

2. **Test qua ứng dụng:**
   - Gửi một câu hỏi trong chat
   - Nếu nhận được phản hồi thì Function đã hoạt động đúng

## Lưu ý

- Region thường là `us-central1` (mặc định)
- Nếu deploy lần đầu, có thể mất 2-5 phút
- Đảm bảo bạn đã đăng nhập Firebase CLI: `firebase login`
- Đảm bảo bạn có quyền deploy Functions trong project

## Troubleshooting

### Lỗi: "Runtime Node.js 18 was decommissioned"
- Đã được fix bằng cách nâng cấp lên Node.js 20

### Lỗi: "An unexpected error has occurred"
- Thử lại sau vài phút
- Kiểm tra kết nối internet
- Kiểm tra quyền truy cập Firebase project

### Lỗi: "Missing required API"
- Firebase sẽ tự động enable các API cần thiết
- Chờ vài phút rồi thử lại



