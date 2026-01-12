# Script kiểm tra Firebase Secrets

Write-Host "🔍 Kiểm tra Firebase Secrets..." -ForegroundColor Cyan
Write-Host ""

# Kiểm tra TELEGRAM_BOT_TOKEN
Write-Host "📋 Kiểm tra TELEGRAM_BOT_TOKEN..." -ForegroundColor Yellow
try {
    $token = npx firebase-tools functions:secrets:access TELEGRAM_BOT_TOKEN 2>&1
    if ($LASTEXITCODE -eq 0 -and $token -and $token.Length -gt 10) {
        Write-Host "✅ TELEGRAM_BOT_TOKEN đã được set" -ForegroundColor Green
        Write-Host "   Token: $($token.Substring(0, 10))...$($token.Substring($token.Length - 5))" -ForegroundColor Gray
    } else {
        Write-Host "❌ TELEGRAM_BOT_TOKEN chưa được set hoặc không hợp lệ" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Không thể truy cập TELEGRAM_BOT_TOKEN" -ForegroundColor Red
    Write-Host "   Lỗi: $_" -ForegroundColor Gray
}

Write-Host ""

# Kiểm tra GEMINI_API_KEY (nếu có)
Write-Host "📋 Kiểm tra GEMINI_API_KEY..." -ForegroundColor Yellow
try {
    $geminiKey = npx firebase-tools functions:secrets:access GEMINI_API_KEY 2>&1
    if ($LASTEXITCODE -eq 0 -and $geminiKey -and $geminiKey.Length -gt 10) {
        Write-Host "✅ GEMINI_API_KEY đã được set" -ForegroundColor Green
        Write-Host "   Key: $($geminiKey.Substring(0, 10))...$($geminiKey.Substring($geminiKey.Length - 5))" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  GEMINI_API_KEY chưa được set (không bắt buộc cho Telegram Auth)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  GEMINI_API_KEY chưa được set" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Để xem tất cả secrets, vào Firebase Console:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/security/secret-manager?project=thithi-3e545" -ForegroundColor White
Write-Host ""
