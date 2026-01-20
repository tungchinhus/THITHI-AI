# Script để rebuild và restart Backend sau khi sửa code
Write-Host "=== Rebuild và Restart Backend ===" -ForegroundColor Cyan

# 1. Dừng các process .NET đang chạy (nếu có)
Write-Host "`n[1/4] Đang dừng các process .NET cũ..." -ForegroundColor Yellow
$dotnetProcesses = Get-Process -Name "dotnet" -ErrorAction SilentlyContinue
if ($dotnetProcesses) {
    $dotnetProcesses | Where-Object { $_.Path -like "*THIHI_AI.Backend*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "   Đã dừng các process .NET cũ" -ForegroundColor Green
} else {
    Write-Host "   Không có process .NET nào đang chạy" -ForegroundColor Gray
}

# 2. Chuyển đến thư mục backend
$backendPath = Join-Path $PSScriptRoot "THIHI_AI.Backend"
if (-not (Test-Path $backendPath)) {
    Write-Host "`n[ERROR] Không tìm thấy thư mục THIHI_AI.Backend" -ForegroundColor Red
    Write-Host "   Đường dẫn mong đợi: $backendPath" -ForegroundColor Red
    exit 1
}

Set-Location $backendPath
Write-Host "`n[2/4] Đã chuyển đến thư mục: $backendPath" -ForegroundColor Green

# 3. Clean và rebuild project
Write-Host "`n[3/4] Đang clean và rebuild project..." -ForegroundColor Yellow
try {
    dotnet clean
    Write-Host "   ✓ Clean thành công" -ForegroundColor Green
    
    dotnet build --configuration Release
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Build thành công" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Build thất bại. Kiểm tra lỗi ở trên." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ✗ Lỗi khi build: $_" -ForegroundColor Red
    exit 1
}

# 4. Chạy backend
Write-Host "`n[4/4] Đang khởi động backend..." -ForegroundColor Yellow
Write-Host "   Backend sẽ chạy tại: http://localhost:5000" -ForegroundColor Cyan
Write-Host "   Nhấn Ctrl+C để dừng backend" -ForegroundColor Gray
Write-Host ""

# Chạy backend trong foreground
dotnet run --configuration Release
