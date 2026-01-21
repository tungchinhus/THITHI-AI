# PowerShell script để chạy test-rag-with-existing-data.js với environment variables
# Usage: .\test-rag-with-existing-data.ps1

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Test RAG với Existing Data" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check và set SQL_SERVER_HOST
if (-not $env:SQL_SERVER_HOST) {
    Write-Host "⚠️  SQL_SERVER_HOST chưa được set" -ForegroundColor Yellow
    $sqlHost = Read-Host "Nhập SQL_SERVER_HOST (hoặc Enter để dùng 'localhost')"
    if ([string]::IsNullOrWhiteSpace($sqlHost)) {
        $env:SQL_SERVER_HOST = "localhost"
        Write-Host "✅ Dùng SQL_SERVER_HOST mặc định: localhost" -ForegroundColor Green
    } else {
        $env:SQL_SERVER_HOST = $sqlHost
        Write-Host "✅ SQL_SERVER_HOST đã được set: $sqlHost" -ForegroundColor Green
    }
} else {
    Write-Host "✅ SQL_SERVER_HOST: $env:SQL_SERVER_HOST" -ForegroundColor Green
}

# Check và set SQL_SERVER_DATABASE (optional, có default)
if (-not $env:SQL_SERVER_DATABASE) {
    $env:SQL_SERVER_DATABASE = "THITHI_AI"
    Write-Host "✅ SQL_SERVER_DATABASE: THITHI_AI (mặc định)" -ForegroundColor Green
} else {
    Write-Host "✅ SQL_SERVER_DATABASE: $env:SQL_SERVER_DATABASE" -ForegroundColor Green
}

# Check và set GEMINI_API_KEY
if (-not $env:GEMINI_API_KEY) {
    Write-Host "⚠️  GEMINI_API_KEY chưa được set" -ForegroundColor Yellow
    $apiKey = Read-Host "Nhập GEMINI_API_KEY"
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        Write-Host "❌ GEMINI_API_KEY là bắt buộc!" -ForegroundColor Red
        Write-Host "   Lấy API key tại: https://makersuite.google.com/app/apikey" -ForegroundColor Yellow
        exit 1
    } else {
        $env:GEMINI_API_KEY = $apiKey
        Write-Host "✅ GEMINI_API_KEY đã được set" -ForegroundColor Green
    }
} else {
    Write-Host "✅ GEMINI_API_KEY: Đã set (${env:GEMINI_API_KEY.Substring(0, [Math]::Min(20, $env:GEMINI_API_KEY.Length))}...)" -ForegroundColor Green
}

# Optional: SQL Server Authentication (nếu cần)
if (-not $env:SQL_SERVER_USER) {
    Write-Host "ℹ️  SQL_SERVER_USER không được set, sẽ dùng Windows Authentication" -ForegroundColor Cyan
} else {
    Write-Host "✅ SQL_SERVER_USER: $env:SQL_SERVER_USER" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Đang chạy test script..." -ForegroundColor Cyan
Write-Host ""

# Chạy Node.js script
node test-rag-with-existing-data.js

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Test hoàn tất!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Test có lỗi (Exit code: $LASTEXITCODE)" -ForegroundColor Red
}

Write-Host ""
Write-Host "💡 Tip: Để set environment variables vĩnh viễn trong PowerShell session này:" -ForegroundColor Yellow
Write-Host "   `$env:SQL_SERVER_HOST = 'localhost'" -ForegroundColor Gray
Write-Host "   `$env:GEMINI_API_KEY = 'your-api-key'" -ForegroundColor Gray
Write-Host ""
