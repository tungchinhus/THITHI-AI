# Script để cập nhật GEMINI_API_KEY vào Firebase Secrets
# Sử dụng: .\update-api-key.ps1

Write-Host "🔐 CẬP NHẬT GEMINI API KEY VÀO FIREBASE SECRETS" -ForegroundColor Cyan
Write-Host ""

# API key mới
$API_KEY = "AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A"

# Kiểm tra Firebase CLI đã cài chưa
Write-Host "📋 Kiểm tra Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version 2>&1
    Write-Host "✅ Firebase CLI đã cài: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI chưa được cài đặt!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vui lòng cài đặt Firebase CLI:" -ForegroundColor Yellow
    Write-Host "  npm install -g firebase-tools" -ForegroundColor White
    Write-Host ""
    Write-Host "Hoặc xem hướng dẫn trong: HUONG_DAN_UPDATE_API_KEY.md" -ForegroundColor Yellow
    exit 1
}

# Kiểm tra đã đăng nhập Firebase chưa
Write-Host ""
Write-Host "📋 Kiểm tra đăng nhập Firebase..." -ForegroundColor Yellow
try {
    $firebaseUser = firebase login:list 2>&1
    if ($firebaseUser -match "No authorized accounts") {
        Write-Host "⚠️  Chưa đăng nhập Firebase!" -ForegroundColor Yellow
        Write-Host "Đang mở trình duyệt để đăng nhập..." -ForegroundColor Yellow
        firebase login
    } else {
        Write-Host "✅ Đã đăng nhập Firebase" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Không thể kiểm tra trạng thái đăng nhập" -ForegroundColor Yellow
}

# Set API key vào Firebase Secrets
Write-Host ""
Write-Host "🔐 Đang set API key vào Firebase Secrets..." -ForegroundColor Yellow
Write-Host "API Key: $($API_KEY.Substring(0, 20))..." -ForegroundColor Gray

try {
    # Tạo file tạm
    $tempFile = [System.IO.Path]::GetTempFileName()
    $API_KEY | Out-File -FilePath $tempFile -Encoding utf8 -NoNewline
    
    # Set secret
    Get-Content $tempFile | firebase functions:secrets:set GEMINI_API_KEY
    
    # Xóa file tạm
    Remove-Item $tempFile -Force
    
    Write-Host ""
    Write-Host "✅ Đã set API key thành công!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Lỗi khi set API key: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Thử cách thủ công:" -ForegroundColor Yellow
    Write-Host "  firebase functions:secrets:set GEMINI_API_KEY" -ForegroundColor White
    Write-Host "  (Sau đó paste API key và nhấn Ctrl+Z rồi Enter)" -ForegroundColor Gray
    exit 1
}

# Kiểm tra secret đã được set
Write-Host ""
Write-Host "🔍 Kiểm tra secret đã được set..." -ForegroundColor Yellow
try {
    $secretValue = firebase functions:secrets:access GEMINI_API_KEY 2>&1
    if ($secretValue -match "AIzaSy") {
        Write-Host "✅ Secret đã được set thành công!" -ForegroundColor Green
        Write-Host "   (Giá trị đã được mask để bảo mật)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Không thể xác nhận secret đã được set" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Không thể kiểm tra secret" -ForegroundColor Yellow
}

# Hỏi có muốn deploy không
Write-Host ""
$deploy = Read-Host "Bạn có muốn deploy lại functions ngay bây giờ? (y/n)"
if ($deploy -eq "y" -or $deploy -eq "Y") {
    Write-Host ""
    Write-Host "🚀 Đang deploy functions..." -ForegroundColor Yellow
    firebase deploy --only functions
} else {
    Write-Host ""
    Write-Host "💡 Để deploy sau, chạy lệnh:" -ForegroundColor Cyan
    Write-Host "   firebase deploy --only functions" -ForegroundColor White
}

Write-Host ""
Write-Host "✅ Hoàn tất!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Xem thêm hướng dẫn trong: HUONG_DAN_UPDATE_API_KEY.md" -ForegroundColor Cyan
