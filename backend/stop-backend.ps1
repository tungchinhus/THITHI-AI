# Script để dừng Backend (.NET)
Write-Host "=== Dừng Backend (.NET) ===" -ForegroundColor Cyan
Write-Host ""

# Tìm và dừng process đang dùng port 5000
Write-Host "[1/2] Đang tìm process đang dùng port 5000..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($pid in $processes) {
        try {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "   Tìm thấy process: $($proc.ProcessName) (PID: $pid)" -ForegroundColor Gray
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "   ✓ Đã dừng process PID: $pid" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "   ✗ Không thể dừng process PID: $pid - $_" -ForegroundColor Red
            Write-Host "   Gợi ý: Chạy PowerShell với quyền Administrator" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   Không tìm thấy process nào đang dùng port 5000" -ForegroundColor Gray
}

# Dừng tất cả process dotnet
Write-Host ""
Write-Host "[2/2] Đang dừng tất cả process dotnet..." -ForegroundColor Yellow
$dotnetProcesses = Get-Process -Name "dotnet" -ErrorAction SilentlyContinue

if ($dotnetProcesses) {
    foreach ($proc in $dotnetProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            Write-Host "   ✓ Đã dừng process: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Green
        }
        catch {
            Write-Host "   ✗ Không thể dừng process: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   Không có process dotnet nào đang chạy" -ForegroundColor Gray
}

# Kiểm tra lại
Write-Host ""
Write-Host "Kiểm tra lại port 5000..." -ForegroundColor Cyan
$stillInUse = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue

if ($stillInUse) {
    Write-Host "⚠️  Port 5000 vẫn còn process đang sử dụng:" -ForegroundColor Yellow
    $stillInUse | ForEach-Object {
        $pid = $_.OwningProcess
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        Write-Host "   - PID: $pid ($($proc.ProcessName))" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Giải pháp:" -ForegroundColor Yellow
    Write-Host "   1. Chạy PowerShell với quyền Administrator và chạy lại script này" -ForegroundColor White
    Write-Host "   2. Hoặc dùng Task Manager để dừng process thủ công" -ForegroundColor White
} else {
    Write-Host "Port 5000 da trong!" -ForegroundColor Green
}
