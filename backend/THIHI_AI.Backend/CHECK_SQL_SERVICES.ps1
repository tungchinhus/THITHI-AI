# Check SQL Server Services for AI Features
# Check Launchpad service and Machine Learning Services configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Check SQL Server Services for AI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Launchpad service
Write-Host "Step 1: Check SQL Server Launchpad Service..." -ForegroundColor Yellow
$launchpadServices = Get-Service | Where-Object {$_.Name -like "*Launchpad*"}

if ($launchpadServices) {
    foreach ($service in $launchpadServices) {
        Write-Host "Service: $($service.Name)" -ForegroundColor White
        Write-Host "Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
        Write-Host "StartType: $($service.StartType)" -ForegroundColor White
        Write-Host ""
        
        if ($service.Status -ne 'Running') {
            Write-Host "WARNING: Launchpad service is not running!" -ForegroundColor Yellow
            Write-Host "Try to start it:" -ForegroundColor Cyan
            Write-Host "Start-Service -Name $($service.Name)" -ForegroundColor White
        }
    }
} else {
    Write-Host "WARNING: No Launchpad service found!" -ForegroundColor Yellow
    Write-Host "Machine Learning Services may not be installed" -ForegroundColor Yellow
}

# Check SQL Server services
Write-Host ""
Write-Host "Step 2: Check SQL Server Services..." -ForegroundColor Yellow
$sqlServices = Get-Service | Where-Object {$_.Name -like "MSSQL*" -or $_.Name -like "SQL Server*"}

foreach ($service in $sqlServices | Select-Object -First 5) {
    Write-Host "Service: $($service.Name) - Status: $($service.Status)" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. If Launchpad is stopped, start it" -ForegroundColor White
Write-Host "2. Check SQL Server configuration in SSMS" -ForegroundColor White
Write-Host "3. If still errors, consider fallback to Python API" -ForegroundColor White
Write-Host ""
