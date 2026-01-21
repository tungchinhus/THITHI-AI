# PowerShell script để kiểm tra kết nối SQL Server
# Usage: .\test-sql-connection.ps1

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SQL Server Connection Diagnostic" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check SQL Server service
Write-Host "📊 Step 1: Kiểm tra SQL Server Service" -ForegroundColor Yellow
Write-Host "─" * 80 -ForegroundColor Gray

try {
    $sqlService = Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue
    if ($sqlService) {
        Write-Host "✅ SQL Server Service: $($sqlService.Status)" -ForegroundColor Green
        if ($sqlService.Status -ne "Running") {
            Write-Host "⚠️  SQL Server service không đang chạy!" -ForegroundColor Red
            Write-Host "   Chạy: Start-Service MSSQLSERVER" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Không tìm thấy SQL Server service (MSSQLSERVER)" -ForegroundColor Red
        Write-Host "   Kiểm tra SQL Server có được cài đặt không" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Không thể kiểm tra SQL Server service: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Check SQL Server Browser service
Write-Host "📊 Step 2: Kiểm tra SQL Server Browser Service" -ForegroundColor Yellow
Write-Host "─" * 80 -ForegroundColor Gray

try {
    $browserService = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
    if ($browserService) {
        Write-Host "✅ SQL Server Browser: $($browserService.Status)" -ForegroundColor Green
        if ($browserService.Status -ne "Running") {
            Write-Host "⚠️  SQL Server Browser không đang chạy (có thể không cần thiết cho localhost)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  SQL Server Browser không tìm thấy (có thể không cần thiết)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "ℹ️  Không thể kiểm tra SQL Server Browser: $_" -ForegroundColor Cyan
}

Write-Host ""

# Step 3: Check port 1433
Write-Host "📊 Step 3: Kiểm tra Port 1433" -ForegroundColor Yellow
Write-Host "─" * 80 -ForegroundColor Gray

try {
    $connection = Test-NetConnection -ComputerName localhost -Port 1433 -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        Write-Host "✅ Port 1433 đang mở và có thể kết nối" -ForegroundColor Green
    } else {
        Write-Host "❌ Port 1433 không thể kết nối" -ForegroundColor Red
        Write-Host "   Kiểm tra firewall hoặc SQL Server có đang lắng nghe trên port này không" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Không thể kiểm tra port 1433: $_" -ForegroundColor Yellow
    Write-Host "   Có thể cần chạy với quyền Administrator" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Check environment variables
Write-Host "📊 Step 4: Kiểm tra Environment Variables" -ForegroundColor Yellow
Write-Host "─" * 80 -ForegroundColor Gray

$sqlHost = $env:SQL_SERVER_HOST
$sqlDatabase = $env:SQL_SERVER_DATABASE
$sqlUser = $env:SQL_SERVER_USER
$sqlPassword = $env:SQL_SERVER_PASSWORD

Write-Host "   SQL_SERVER_HOST: $($sqlHost ?? '❌ Not set (will use localhost)')" -ForegroundColor $(if ($sqlHost) { "Green" } else { "Yellow" })
Write-Host "   SQL_SERVER_DATABASE: $($sqlDatabase ?? '❌ Not set (will use THITHI_AI)')" -ForegroundColor $(if ($sqlDatabase) { "Green" } else { "Yellow" })
Write-Host "   SQL_SERVER_USER: $($sqlUser ?? '❌ Not set (will use Windows Authentication)')" -ForegroundColor $(if ($sqlUser) { "Green" } else { "Cyan" })
Write-Host "   SQL_SERVER_PASSWORD: $($sqlPassword ? '✅ Set' : '❌ Not set')" -ForegroundColor $(if ($sqlPassword) { "Green" } else { "Cyan" })

$useWindowsAuth = -not $sqlUser -and -not $sqlPassword
Write-Host ""
Write-Host "   Authentication Mode: $(if ($useWindowsAuth) { 'Windows Authentication' } else { 'SQL Server Authentication' })" -ForegroundColor Cyan

Write-Host ""

# Step 5: Test with sqlcmd (if available)
Write-Host "📊 Step 5: Test với sqlcmd (nếu có)" -ForegroundColor Yellow
Write-Host "─" * 80 -ForegroundColor Gray

$sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue
if ($sqlcmdPath) {
    Write-Host "✅ sqlcmd được tìm thấy" -ForegroundColor Green
    
    $testServer = $sqlHost ?? "localhost"
    $testDatabase = $sqlDatabase ?? "THITHI_AI"
    
    Write-Host "   Đang test kết nối đến $testServer\$testDatabase..." -ForegroundColor Cyan
    
    if ($useWindowsAuth) {
        $result = sqlcmd -S $testServer -d $testDatabase -E -Q "SELECT @@VERSION" -W -h -1 2>&1
    } else {
        $result = sqlcmd -S $testServer -d $testDatabase -U $sqlUser -P $sqlPassword -Q "SELECT @@VERSION" -W -h -1 2>&1
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Kết nối SQL Server thành công!" -ForegroundColor Green
        Write-Host "   Version: $($result -join ' ')" -ForegroundColor Gray
    } else {
        Write-Host "❌ Kết nối SQL Server thất bại" -ForegroundColor Red
        Write-Host "   Error: $($result -join ' ')" -ForegroundColor Red
    }
} else {
    Write-Host "ℹ️  sqlcmd không tìm thấy (có thể không được cài đặt)" -ForegroundColor Cyan
    Write-Host "   sqlcmd thường đi kèm với SQL Server" -ForegroundColor Gray
}

Write-Host ""

# Step 6: Recommendations
Write-Host "📊 Step 6: Khuyến nghị" -ForegroundColor Yellow
Write-Host "─" * 80 -ForegroundColor Gray

Write-Host ""
Write-Host "💡 Nếu kết nối thất bại, thử các bước sau:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Đảm bảo SQL Server đang chạy:" -ForegroundColor White
Write-Host "   Get-Service MSSQLSERVER" -ForegroundColor Gray
Write-Host "   Start-Service MSSQLSERVER  # Nếu không chạy" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Kiểm tra SQL Server có lắng nghe trên port 1433:" -ForegroundColor White
Write-Host "   Get-NetTCPConnection -LocalPort 1433 -ErrorAction SilentlyContinue" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Nếu dùng Windows Authentication, đảm bảo:" -ForegroundColor White
Write-Host "   - Windows Authentication được enable trong SQL Server" -ForegroundColor Gray
Write-Host "   - User hiện tại có quyền truy cập database" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Nếu dùng SQL Server Authentication:" -ForegroundColor White
Write-Host "   `$env:SQL_SERVER_USER = 'sa'" -ForegroundColor Gray
Write-Host "   `$env:SQL_SERVER_PASSWORD = 'your-password'" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test kết nối với Node.js:" -ForegroundColor White
Write-Host "   node test-rag-with-existing-data.js" -ForegroundColor Gray
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
