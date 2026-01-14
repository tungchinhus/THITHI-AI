# Script để kiểm tra và cấu hình GEMINI_API_KEY
# Sử dụng: .\fix-gemini-api-key.ps1 [YOUR_API_KEY]

param(
    [string]$ApiKey = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 KIỂM TRA VÀ CẤU HÌNH GEMINI API KEY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Firebase CLI
Write-Host "📋 Bước 1: Kiểm tra Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = npx firebase-tools --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Firebase CLI đã sẵn sàng" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Firebase CLI chưa được cài đặt" -ForegroundColor Yellow
        Write-Host "   Đang cài đặt firebase-tools..." -ForegroundColor Yellow
        npm install -g firebase-tools
    }
} catch {
    Write-Host "⚠️ Không tìm thấy Firebase CLI. Đang cài đặt..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

Write-Host ""

# Kiểm tra API key hiện tại
Write-Host "📋 Bước 2: Kiểm tra API key hiện tại..." -ForegroundColor Yellow
try {
    $currentKey = npx firebase-tools functions:secrets:access GEMINI_API_KEY 2>&1
    if ($LASTEXITCODE -eq 0 -and $currentKey -and $currentKey.Length -gt 20) {
        Write-Host "✅ Đã tìm thấy API key hiện tại" -ForegroundColor Green
        Write-Host "   Key preview: $($currentKey.Substring(0, [Math]::Min(10, $currentKey.Length)))..." -ForegroundColor Gray
        Write-Host ""
        $useCurrent = Read-Host "Bạn có muốn giữ API key hiện tại? (Y/N)"
        if ($useCurrent -eq "Y" -or $useCurrent -eq "y") {
            Write-Host "✅ Giữ nguyên API key hiện tại" -ForegroundColor Green
            $ApiKey = $currentKey.Trim()
        } else {
            $ApiKey = ""
        }
    } else {
        Write-Host "⚠️ Chưa có API key được cấu hình" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Không thể truy cập secret hiện tại (có thể chưa được set)" -ForegroundColor Yellow
}

Write-Host ""

# Nhập API key mới nếu chưa có
if (-not $ApiKey -or $ApiKey.Length -lt 20) {
    Write-Host "📋 Bước 3: Nhập API key mới..." -ForegroundColor Yellow
    if (-not $ApiKey) {
        Write-Host ""
        Write-Host "💡 Để lấy API key mới:" -ForegroundColor Cyan
        Write-Host "   1. Truy cập: https://makersuite.google.com/app/apikey" -ForegroundColor White
        Write-Host "   2. Đăng nhập với tài khoản Google" -ForegroundColor White
        Write-Host "   3. Click 'Create API Key'" -ForegroundColor White
        Write-Host "   4. Copy API key (format: AIza...)" -ForegroundColor White
        Write-Host ""
        $ApiKey = Read-Host "Nhập API key của bạn (hoặc Enter để bỏ qua)"
    }
    
    if (-not $ApiKey -or $ApiKey.Length -lt 20) {
        Write-Host "❌ API key không hợp lệ hoặc bị bỏ qua" -ForegroundColor Red
        Write-Host ""
        Write-Host "📝 Hướng dẫn thủ công:" -ForegroundColor Yellow
        Write-Host "   1. Lấy API key từ: https://makersuite.google.com/app/apikey" -ForegroundColor White
        Write-Host "   2. Chạy lệnh: echo YOUR_API_KEY | npx firebase-tools functions:secrets:set GEMINI_API_KEY" -ForegroundColor White
        Write-Host "   3. Deploy lại: npx firebase-tools deploy --only functions" -ForegroundColor White
        exit 1
    }
}

# Validate API key format
if (-not $ApiKey.StartsWith("AIza")) {
    Write-Host "⚠️ Cảnh báo: API key không đúng format (thường bắt đầu bằng 'AIza')" -ForegroundColor Yellow
    $continue = Read-Host "Bạn có muốn tiếp tục? (Y/N)"
    if ($continue -ne "Y" -and $continue -ne "y") {
        exit 1
    }
}

Write-Host ""

# Set secret
Write-Host "📋 Bước 4: Đang set secret..." -ForegroundColor Yellow
try {
    $ApiKey | npx firebase-tools functions:secrets:set GEMINI_API_KEY
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Đã set secret thành công!" -ForegroundColor Green
    } else {
        Write-Host "❌ Lỗi khi set secret" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Lỗi khi set secret: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Deploy function
Write-Host "📋 Bước 5: Deploy lại function..." -ForegroundColor Yellow
$deploy = Read-Host "Bạn có muốn deploy lại function ngay bây giờ? (Y/N)"
if ($deploy -eq "Y" -or $deploy -eq "y") {
    try {
        Write-Host "🚀 Đang deploy function..." -ForegroundColor Cyan
        npx firebase-tools deploy --only functions
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Hoàn tất! Function đã được deploy với API key mới" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Deploy có thể đã thất bại. Kiểm tra logs ở trên." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Lỗi khi deploy: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Bạn có thể deploy thủ công bằng lệnh:" -ForegroundColor Yellow
        Write-Host "   npx firebase-tools deploy --only functions" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "💡 Nhớ deploy lại function để API key có hiệu lực:" -ForegroundColor Yellow
    Write-Host "   npx firebase-tools deploy --only functions" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ HOÀN TẤT!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Các bước tiếp theo:" -ForegroundColor Yellow
Write-Host "   1. Đảm bảo đã enable 'Generative Language API' tại:" -ForegroundColor White
Write-Host "      https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com" -ForegroundColor Gray
Write-Host "   2. Test lại ứng dụng chat" -ForegroundColor White
Write-Host "   3. Kiểm tra logs nếu có lỗi:" -ForegroundColor White
Write-Host "      npx firebase-tools functions:log --only chatFunction" -ForegroundColor Gray
Write-Host ""
