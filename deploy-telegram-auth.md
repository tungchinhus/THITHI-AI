# Hướng Dẫn Deploy Telegram Authentication Functions

## Bước 1: Kiểm Tra Prerequisites

### 1.1. Cài đặt Firebase CLI (nếu chưa có)

```bash
npm install -g firebase-tools
```

Hoặc sử dụng npx (không cần cài global):

```bash
npx firebase-tools --version
```

### 1.2. Đăng nhập Firebase

```bash
firebase login
```

Hoặc:

```bash
npx firebase-tools login
```

### 1.3. Kiểm tra project hiện tại

```bash
firebase projects:list
firebase use thithi-3e545
```

## Bước 2: Set Telegram Bot Token Secret

**QUAN TRỌNG**: Phải set secret trước khi deploy!

```bash
# Cách 1: Set và nhập token khi được hỏi
firebase functions:secrets:set TELEGRAM_BOT_TOKEN

# Cách 2: Set trực tiếp từ command line
echo "YOUR_BOT_TOKEN" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

**Lưu ý**: Thay `YOUR_BOT_TOKEN` bằng bot token thực tế từ @BotFather

**Kiểm tra secret đã được set:**

```bash
firebase functions:secrets:list
firebase functions:secrets:access TELEGRAM_BOT_TOKEN
```

## Bước 3: Deploy Functions

### 3.1. Deploy chỉ Telegram Auth Functions

```bash
cd functions
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

### 3.2. Deploy tất cả Functions

```bash
cd functions
firebase deploy --only functions
```

### 3.3. Deploy từ thư mục gốc

```bash
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

## Bước 4: Kiểm Tra Sau Khi Deploy

### 4.1. Xem Function URLs

Sau khi deploy thành công, Firebase sẽ hiển thị URLs:

```
✔  functions[telegramOnboarding(us-central1)] Successful create operation.
✔  functions[telegramLogin(us-central1)] Successful create operation.

Function URLs:
  telegramOnboarding: https://us-central1-thithi-3e545.cloudfunctions.net/telegramOnboarding
  telegramLogin: https://us-central1-thithi-3e545.cloudfunctions.net/telegramLogin
```

### 4.2. Test Functions

**Test Onboarding (cần bot token):**

```bash
curl -X POST https://us-central1-thithi-3e545.cloudfunctions.net/telegramOnboarding \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0901234567",
    "telegramId": "123456789"
  }'
```

**Test Login (cần initData từ Telegram):**

```bash
curl -X POST https://us-central1-thithi-3e545.cloudfunctions.net/telegramLogin \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "query_id=...&user=...&auth_date=...&hash=..."
  }'
```

### 4.3. Xem Logs

```bash
firebase functions:log --only telegramOnboarding,telegramLogin
```

## Bước 5: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## Troubleshooting

### Lỗi: "TELEGRAM_BOT_TOKEN secret not configured"

**Giải pháp:**
1. Set secret: `echo "YOUR_BOT_TOKEN" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN`
2. Deploy lại: `firebase deploy --only functions:telegramOnboarding,functions:telegramLogin`

### Lỗi: "Permission denied" hoặc "Not authenticated"

**Giải pháp:**
1. Đăng nhập lại: `firebase login`
2. Kiểm tra project: `firebase use thithi-3e545`
3. Kiểm tra quyền trong Firebase Console

### Lỗi: "Secret Manager API not enabled"

**Giải pháp:**
1. Enable Secret Manager API: https://console.cloud.google.com/apis/library/secretmanager.googleapis.com
2. Xem hướng dẫn: `HUONG_DAN_ENABLE_SECRET_MANAGER.md`

### Lỗi: "Function deployment failed"

**Giải pháp:**
1. Kiểm tra logs: `firebase functions:log`
2. Kiểm tra code trong `functions/index.js`
3. Đảm bảo tất cả dependencies đã được cài: `cd functions && npm install`

## Script Deploy Tự Động

Tạo file `deploy-telegram.sh` (cho Linux/Mac) hoặc `deploy-telegram.ps1` (cho Windows):

### deploy-telegram.sh (Linux/Mac)

```bash
#!/bin/bash

echo "🚀 Deploying Telegram Authentication Functions..."

# Check if secret is set
if ! firebase functions:secrets:access TELEGRAM_BOT_TOKEN > /dev/null 2>&1; then
  echo "❌ TELEGRAM_BOT_TOKEN secret not set!"
  echo "💡 Run: echo 'YOUR_BOT_TOKEN' | firebase functions:secrets:set TELEGRAM_BOT_TOKEN"
  exit 1
fi

echo "✅ Secret found, deploying functions..."

# Deploy functions
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin

# Deploy Firestore rules
echo "📋 Deploying Firestore rules..."
firebase deploy --only firestore:rules

echo "✅ Deployment complete!"
```

### deploy-telegram.ps1 (Windows PowerShell)

```powershell
# Deploy Telegram Authentication Functions

Write-Host "🚀 Deploying Telegram Authentication Functions..." -ForegroundColor Cyan

# Check if secret is set
try {
    $secret = firebase functions:secrets:access TELEGRAM_BOT_TOKEN 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ TELEGRAM_BOT_TOKEN secret not set!" -ForegroundColor Red
        Write-Host "💡 Run: echo 'YOUR_BOT_TOKEN' | firebase functions:secrets:set TELEGRAM_BOT_TOKEN" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Secret found" -ForegroundColor Green
} catch {
    Write-Host "❌ Error checking secret: $_" -ForegroundColor Red
    exit 1
}

# Deploy functions
Write-Host "📦 Deploying functions..." -ForegroundColor Cyan
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Functions deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Function deployment failed!" -ForegroundColor Red
    exit 1
}

# Deploy Firestore rules
Write-Host "📋 Deploying Firestore rules..." -ForegroundColor Cyan
firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Firestore rules deployed successfully!" -ForegroundColor Green
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
} else {
    Write-Host "❌ Firestore rules deployment failed!" -ForegroundColor Red
    exit 1
}
```

## Lưu Ý Quan Trọng

1. **Phải set secret trước khi deploy** - Nếu không, functions sẽ không hoạt động
2. **Kiểm tra Function URLs** - Lưu lại URLs để cấu hình Telegram Bot
3. **Test sau khi deploy** - Đảm bảo functions hoạt động đúng
4. **Deploy Firestore rules** - Quan trọng cho bảo mật

## Next Steps

Sau khi deploy thành công:

1. ✅ Lưu Function URLs
2. ✅ Cấu hình Telegram Bot với Mini App URL
3. ✅ Tạo collection `employees` trong Firestore
4. ✅ Test onboarding và login
5. ✅ Cập nhật frontend environment nếu cần

Xem `HUONG_DAN_TELEGRAM_AUTH.md` để biết chi tiết về cách sử dụng.
