# Test SQL Server Connection
$connectionString = "Server=.\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=123456;TrustServerCertificate=true;Encrypt=true;"

Write-Host "Testing SQL Server connection..." -ForegroundColor Yellow
Write-Host "Connection String: Server=.\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=***;TrustServerCertificate=true;Encrypt=true;" -ForegroundColor Gray

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    Write-Host "✅ Connection successful!" -ForegroundColor Green
    Write-Host "Server Version: $($connection.ServerVersion)" -ForegroundColor Cyan
    Write-Host "Database: $($connection.Database)" -ForegroundColor Cyan
    $connection.Close()
} catch {
    Write-Host "❌ Connection failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible solutions:" -ForegroundColor Yellow
    Write-Host "1. Check if SQL Server is running" -ForegroundColor White
    Write-Host "2. Verify instance name: .\MSSQLSERVER2025" -ForegroundColor White
    Write-Host "3. Check username/password" -ForegroundColor White
    Write-Host "4. Try: Server=(local)\MSSQLSERVER2025 or Server=localhost\MSSQLSERVER2025" -ForegroundColor White
}
