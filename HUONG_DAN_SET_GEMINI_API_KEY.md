# Hướng dẫn cấu hình Google Gemini API Key

## Bước 1: Lấy Gemini API Key

1. Truy cập: https://makersuite.google.com/app/apikey
2. Đăng nhập với tài khoản Google
3. Click "Create API Key"
4. Copy API key (format: `AIza...`)

## Bước 2: Set Secret trong Firebase Functions

Sử dụng Firebase Secrets Manager (khuyến nghị):

```bash
cd c:\MyData\projects\THIHI_AI
firebase functions:secrets:set GEMINI_API_KEY
```

Khi được hỏi, paste API key của bạn.

## Bước 3: Deploy lại Function

Sau khi set secret, cần deploy lại Function để secret có hiệu lực:

```bash
firebase deploy --only functions:chatFunction
```

Firebase sẽ tự động:
- Lấy secret từ Secrets Manager
- Inject vào Function khi chạy
- Bảo mật secret (không hiển thị trong logs)

## Bước 4: Kiểm tra

1. Gửi một câu hỏi trong ứng dụng chat
2. Nếu nhận được phản hồi từ Gemini (không phải mock response) thì đã thành công

## Lưu ý

- **Bảo mật:** Secret được lưu trữ an toàn trong Firebase Secrets Manager
- **Quota:** Gemini API có giới hạn quota miễn phí. Kiểm tra tại Google Cloud Console
- **Model:** Hiện đang sử dụng `gemini-pro`. Có thể đổi sang `gemini-pro-vision` nếu cần xử lý hình ảnh

## Troubleshooting

### Lỗi: "API key không hợp lệ"
- Kiểm tra lại API key đã copy đúng chưa
- Đảm bảo API key chưa bị revoke
- Kiểm tra secret đã được set đúng chưa: `firebase functions:secrets:access GEMINI_API_KEY`

### Lỗi: "Quota exceeded"
- Đã vượt quá quota miễn phí
- Cần upgrade lên paid plan hoặc đợi reset quota

### Function vẫn trả về mock response
- Kiểm tra secret đã được set: `firebase functions:secrets:list`
- Đảm bảo đã deploy lại Function sau khi set secret
- Kiểm tra logs: `firebase functions:log --only chatFunction`

## Xem Secret (chỉ để debug)

```bash
firebase functions:secrets:access GEMINI_API_KEY
```

## Xóa Secret

Nếu cần xóa secret:

```bash
firebase functions:secrets:destroy GEMINI_API_KEY
```

Sau đó deploy lại Function.

