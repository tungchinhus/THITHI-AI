# =============================================
# Script Setup ONNX Runtime cho SQL Server 2025
# =============================================
# Tự động tạo thư mục, download ONNX Runtime, và set permissions
# =============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup ONNX Runtime cho SQL Server 2025" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$runtimePath = "C:\onnx_runtime"
$dllName = "onnxruntime.dll"

# =============================================
# Bước 1: Tạo thư mục
# =============================================
Write-Host "Bước 1: Tạo thư mục ONNX Runtime..." -ForegroundColor Yellow

if (-not (Test-Path $runtimePath)) {
    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
    Write-Host "✅ Đã tạo thư mục: $runtimePath" -ForegroundColor Green
} else {
    Write-Host "✅ Thư mục đã tồn tại: $runtimePath" -ForegroundColor Green
}

# =============================================
# Bước 2: Kiểm tra ONNX Runtime DLL
# =============================================
Write-Host ""
Write-Host "Bước 2: Kiểm tra ONNX Runtime DLL..." -ForegroundColor Yellow

$dllPath = Join-Path $runtimePath $dllName

if (Test-Path $dllPath) {
    $dllInfo = Get-Item $dllPath
    Write-Host "✅ ONNX Runtime DLL đã tồn tại:" -ForegroundColor Green
    Write-Host "   Path: $dllPath" -ForegroundColor White
    Write-Host "   Size: $([math]::Round($dllInfo.Length / 1MB, 2)) MB" -ForegroundColor White
    Write-Host "   Modified: $($dllInfo.LastWriteTime)" -ForegroundColor White
} else {
    Write-Host "⚠️  ONNX Runtime DLL chưa có!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Cần download ONNX Runtime:" -ForegroundColor Cyan
    Write-Host "1. Truy cập: https://github.com/microsoft/onnxruntime/releases" -ForegroundColor White
    Write-Host "2. Download version mới nhất (>= 1.19) cho Windows x64" -ForegroundColor White
    Write-Host "3. Extract file onnxruntime.dll" -ForegroundColor White
    Write-Host "4. Copy vào: $dllPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Hoặc chạy lệnh này để download tự động (nếu có wget/curl):" -ForegroundColor Cyan
    Write-Host "# Tìm link download mới nhất từ GitHub releases" -ForegroundColor Gray
    Write-Host ""
    
    $continue = Read-Host "Bạn đã copy onnxruntime.dll vào $runtimePath chưa? (Y/N)"
    if ($continue -ne "Y" -and $continue -ne "y") {
        Write-Host "⚠️  Vui lòng download và copy onnxruntime.dll vào $runtimePath trước" -ForegroundColor Yellow
        Write-Host "Sau đó chạy lại script này để set permissions" -ForegroundColor Yellow
        exit 1
    }
    
    if (-not (Test-Path $dllPath)) {
        Write-Host "❌ Vẫn không tìm thấy onnxruntime.dll tại $dllPath" -ForegroundColor Red
        Write-Host "Vui lòng kiểm tra lại" -ForegroundColor Red
        exit 1
    }
}

# =============================================
# Bước 3: Set permissions cho SQL Server
# =============================================
Write-Host ""
Write-Host "Bước 3: Set permissions cho SQL Server..." -ForegroundColor Yellow

$sqlServiceAccount = "NT SERVICE\MSSQLSERVER"

try {
    # Set permissions cho thư mục
    $result = icacls $runtimePath /grant "${sqlServiceAccount}:(OI)(CI)R" /T 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Đã set permissions cho $sqlServiceAccount" -ForegroundColor Green
        Write-Host "   Thư mục: $runtimePath" -ForegroundColor White
        Write-Host "   Permissions: Read (R)" -ForegroundColor White
    } else {
        Write-Host "⚠️  Không thể set permissions tự động (có thể cần quyền Administrator)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Chạy thủ công với quyền Administrator:" -ForegroundColor Cyan
        Write-Host "icacls `"$runtimePath`" /grant `"$sqlServiceAccount:(OI)(CI)R`" /T" -ForegroundColor White
    }
} catch {
    Write-Host "⚠️  Lỗi khi set permissions: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Chạy thủ công với quyền Administrator:" -ForegroundColor Cyan
    Write-Host "icacls `"$runtimePath`" /grant `"$sqlServiceAccount:(OI)(CI)R`" /T" -ForegroundColor White
}

# =============================================
# Bước 4: Kiểm tra permissions
# =============================================
Write-Host ""
Write-Host "Bước 4: Kiểm tra permissions..." -ForegroundColor Yellow

try {
    $acl = Get-Acl $runtimePath
    $hasPermission = $acl.Access | Where-Object {
        $_.IdentityReference -eq $sqlServiceAccount -and
        $_.FileSystemRights -match "Read"
    }
    
    if ($hasPermission) {
        Write-Host "OK: SQL Server service account co quyen doc" -ForegroundColor Green
    } else {
        Write-Host "WARNING: SQL Server service account co the chua co quyen doc" -ForegroundColor Yellow
        Write-Host "   Vui long chay lai voi quyen Administrator" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Không thể kiểm tra permissions" -ForegroundColor Yellow
}

# =============================================
# Hoàn tất
# =============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ HOÀN TẤT!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bước tiếp theo:" -ForegroundColor Yellow
Write-Host "1. Chạy script CREATE_ONNX_MODEL_WITH_RUNTIME.sql trong SQL Server" -ForegroundColor White
Write-Host "2. Test với SQL query trong SQL Server Management Studio" -ForegroundColor White
Write-Host ""
