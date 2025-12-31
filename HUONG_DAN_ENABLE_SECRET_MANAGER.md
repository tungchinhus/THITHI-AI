# 🔧 Hướng dẫn Enable Secret Manager API

## Vấn đề

Khi chạy lệnh `firebase functions:secrets:access GEMINI_API_KEY`, gặp lỗi:
```
Error: Request to https://serviceusage.googleapis.com/v1/projects/thithi-3e545/services/secretmanager.googleapis.com had HTTP Error: 403, Permission denied to get service [secretmanager.googleapis.com]
```

**Nguyên nhân:** Secret Manager API chưa được enable trong Google Cloud Console.

## Cách khắc phục

### Bước 1: Enable Secret Manager API

1. **Truy cập Google Cloud Console:**
   - Link: https://console.cloud.google.com/apis/library/secretmanager.googleapis.com
   - Hoặc vào: https://console.cloud.google.com → APIs & Services → Library → tìm "Secret Manager API"

2. **Chọn project:**
   - Đảm bảo chọn đúng project: `thithi-3e545`

3. **Click "Enable":**
   - Nếu đã enable, sẽ hiển thị "API enabled"
   - Nếu chưa, click nút "Enable" và đợi vài giây

### Bước 2: Kiểm tra quyền

Đảm bảo tài khoản `tungchinhus@gmail.com` có quyền:
- **Secret Manager Admin** hoặc
- **Secret Manager Secret Accessor** (ít nhất)

Kiểm tra quyền:
1. Vào: https://console.cloud.google.com/iam-admin/iam?project=thithi-3e545
2. Tìm email `tungchinhus@gmail.com`
3. Kiểm tra role có chứa "Secret Manager" không

### Bước 3: Thử lại lệnh

Sau khi enable API, thử lại:

```bash
npx firebase-tools functions:secrets:access GEMINI_API_KEY
```

## Các cách thay thế (nếu vẫn không được)

### Cách 1: Kiểm tra API key từ Google Cloud Console

1. Truy cập: https://console.cloud.google.com/security/secret-manager?project=thithi-3e545
2. Tìm secret `GEMINI_API_KEY`
3. Click vào secret → View secret value
4. Copy API key để test

### Cách 2: Test trực tiếp với API key

Nếu bạn đã có API key (từ MakerSuite hoặc đã lưu ở đâu đó):

```bash
# Test với script kiểm tra
node check-error.js YOUR_API_KEY
```

### Cách 3: Kiểm tra từ ứng dụng đang chạy

Nếu ứng dụng đang chạy và gặp lỗi quota, bạn có thể:

1. **Mở Developer Tools** trong trình duyệt (F12)
2. **Tab Console** → xem lỗi chi tiết
3. **Tab Network** → xem response từ Firebase Function
4. Response sẽ chứa thông tin lỗi chi tiết từ Gemini API

### Cách 4: Kiểm tra logs từ Firebase Console

1. Truy cập: https://console.firebase.google.com/project/thithi-3e545/functions/logs
2. Chọn function `chatFunction`
3. Xem logs gần đây để tìm lỗi chi tiết

## Kiểm tra Secret đã được set chưa

Nếu không thể truy cập secret, có thể kiểm tra bằng cách:

```bash
# List tất cả secrets
npx firebase-tools functions:secrets:list
```

Nếu `GEMINI_API_KEY` không có trong danh sách, cần set lại:

```bash
# Set secret (sẽ hỏi nhập API key)
npx firebase-tools functions:secrets:set GEMINI_API_KEY

# Hoặc set trực tiếp
echo YOUR_API_KEY | npx firebase-tools functions:secrets:set GEMINI_API_KEY
```

Sau đó deploy lại function:

```bash
npx firebase-tools deploy --only functions:chatFunction
```

## Lưu ý

- **Secret Manager API** là service miễn phí của Google Cloud
- Chỉ cần enable một lần, sau đó có thể sử dụng bình thường
- Nếu vẫn gặp lỗi 403 sau khi enable, có thể cần thêm quyền IAM

## Links hữu ích

- **Enable Secret Manager API:** https://console.cloud.google.com/apis/library/secretmanager.googleapis.com
- **Secret Manager Console:** https://console.cloud.google.com/security/secret-manager?project=thithi-3e545
- **IAM & Admin:** https://console.cloud.google.com/iam-admin/iam?project=thithi-3e545
- **Firebase Console:** https://console.firebase.google.com/project/thithi-3e545

