# Hướng Dẫn Set Telegram Bot Token

## Bước 1: Lấy Bot Token từ BotFather

### 1.1. Tạo Bot mới (nếu chưa có)

1. Mở Telegram và tìm [@BotFather](https://t.me/botfather)
2. Gửi lệnh `/newbot`
3. Làm theo hướng dẫn:
   - Nhập tên bot (ví dụ: "My Company Bot")
   - Nhập username bot (phải kết thúc bằng `bot`, ví dụ: `mycompany_bot`)
4. BotFather sẽ trả về **Bot Token** dạng:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
   ```

### 1.2. Lấy Token của Bot hiện có

1. Mở [@BotFather](https://t.me/botfather)
2. Gửi lệnh `/mybots`
3. Chọn bot của bạn
4. Chọn "API Token"
5. BotFather sẽ hiển thị token hiện tại
6. Hoặc gửi lệnh `/token` và chọn bot

**Lưu ý**: Token có dạng: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890`

## Bước 2: Set Token vào Firebase Secrets

### Cách 1: Set và nhập token khi được hỏi (Khuyến nghị)

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

Sau đó:
1. Terminal sẽ hỏi: `Enter a value for TELEGRAM_BOT_TOKEN:`
2. Dán token từ BotFather (ví dụ: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890`)
3. Nhấn Enter

**Lưu ý**: Token sẽ không hiển thị trên màn hình khi bạn gõ (bảo mật)

### Cách 2: Set trực tiếp từ command line

**Windows (PowerShell):**
```powershell
echo "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

**Linux/Mac:**
```bash
echo "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

**Lưu ý**: Thay `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890` bằng token thực tế của bạn

### Cách 3: Set từ file (nếu token dài)

1. Tạo file `bot-token.txt` (KHÔNG commit file này vào git!)
2. Dán token vào file
3. Chạy lệnh:

**Windows (PowerShell):**
```powershell
Get-Content bot-token.txt | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

**Linux/Mac:**
```bash
cat bot-token.txt | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

4. Xóa file `bot-token.txt` sau khi set xong

## Bước 3: Kiểm Tra Secret Đã Được Set

### 3.1. Kiểm tra secret đã được set

**Cách 1: Truy cập secret (để verify)**

```bash
firebase functions:secrets:access TELEGRAM_BOT_TOKEN
```

Hoặc:

```bash
npx firebase-tools functions:secrets:access TELEGRAM_BOT_TOKEN
```

Nếu hiển thị token, nghĩa là đã set thành công.

**Cách 2: Xem trong Firebase Console**

1. Truy cập: https://console.cloud.google.com/security/secret-manager?project=thithi-3e545
2. Tìm secret `TELEGRAM_BOT_TOKEN` trong danh sách
3. Click vào để xem chi tiết

**Lưu ý**: Command `firebase functions:secrets:list` không tồn tại trong một số phiên bản Firebase CLI. Dùng `access` hoặc Firebase Console để kiểm tra.

### 3.2. Xem giá trị secret (để verify)

```bash
firebase functions:secrets:access TELEGRAM_BOT_TOKEN
```

**Lưu ý**: Chỉ nên dùng để kiểm tra, không nên in ra trong production code.

## Bước 4: Deploy Functions Sau Khi Set Secret

Sau khi set secret, **PHẢI deploy lại functions** để secret có hiệu lực:

```bash
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

Hoặc deploy tất cả functions:

```bash
firebase deploy --only functions
```

## Troubleshooting

### Lỗi: "Secret Manager API not enabled"

**Giải pháp:**
1. Enable Secret Manager API: https://console.cloud.google.com/apis/library/secretmanager.googleapis.com
2. Xem hướng dẫn chi tiết: `HUONG_DAN_ENABLE_SECRET_MANAGER.md`

### Lỗi: "Permission denied" hoặc "Not authenticated"

**Giải pháp:**
1. Đăng nhập Firebase: `firebase login`
2. Kiểm tra project: `firebase use thithi-3e545`
3. Kiểm tra quyền trong Firebase Console

### Lỗi: "Invalid token format"

**Nguyên nhân**: Token không đúng định dạng

**Giải pháp:**
- Token phải có dạng: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890`
- Không có khoảng trắng ở đầu/cuối
- Copy chính xác từ BotFather

### Lỗi: "Secret not found" sau khi deploy

**Nguyên nhân**: Secret chưa được set hoặc deploy trước khi set secret

**Giải pháp:**
1. Kiểm tra secret: `firebase functions:secrets:list`
2. Set lại secret nếu cần
3. Deploy lại functions

## Ví Dụ Hoàn Chỉnh

### Ví dụ 1: Set token lần đầu

```bash
# 1. Lấy token từ BotFather (ví dụ: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890)

# 2. Set secret
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
# Nhập token khi được hỏi

# 3. Kiểm tra
firebase functions:secrets:list

# 4. Deploy
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

### Ví dụ 2: Set token từ command line

```powershell
# Windows PowerShell
$token = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890"
echo $token | firebase functions:secrets:set TELEGRAM_BOT_TOKEN

# Kiểm tra
firebase functions:secrets:access TELEGRAM_BOT_TOKEN

# Deploy
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

### Ví dụ 3: Update token (nếu token bị lộ)

```bash
# 1. Revoke token cũ trong BotFather: /revoke
# 2. Lấy token mới: /token
# 3. Set token mới
firebase functions:secrets:set TELEGRAM_BOT_TOKEN

# 4. Deploy lại
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

## Bảo Mật

⚠️ **QUAN TRỌNG**:

1. **KHÔNG commit token vào Git**
   - Thêm `bot-token.txt` vào `.gitignore`
   - Không dán token vào code hoặc config files

2. **KHÔNG chia sẻ token công khai**
   - Token cho phép kiểm soát bot của bạn
   - Ai có token đều có thể điều khiển bot

3. **Revoke token nếu bị lộ**
   - Vào BotFather: `/revoke`
   - Chọn bot
   - Tạo token mới

4. **Sử dụng Secret Manager**
   - Luôn dùng Firebase Secret Manager
   - Không hardcode token trong code

## Kiểm Tra Token Có Hoạt Động

Sau khi set và deploy, test token bằng cách:

1. **Test Onboarding endpoint** (cần có employee trong Firestore):
```bash
curl -X POST https://your-function-url/telegramOnboarding \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0901234567",
    "telegramId": "123456789"
  }'
```

2. **Kiểm tra logs**:
```bash
firebase functions:log --only telegramOnboarding,telegramLogin
```

Nếu thấy lỗi "TELEGRAM_BOT_TOKEN secret not configured", có nghĩa là:
- Secret chưa được set, HOẶC
- Functions chưa được deploy sau khi set secret

## Tóm Tắt

1. ✅ Lấy token từ @BotFather
2. ✅ Set secret: `firebase functions:secrets:set TELEGRAM_BOT_TOKEN`
3. ✅ Kiểm tra: `firebase functions:secrets:list`
4. ✅ Deploy: `firebase deploy --only functions:telegramOnboarding,functions:telegramLogin`

Xem thêm:
- `HUONG_DAN_ENABLE_SECRET_MANAGER.md` - Enable Secret Manager API
- `HUONG_DAN_TELEGRAM_AUTH.md` - Hướng dẫn đầy đủ về Telegram Auth
