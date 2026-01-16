# PowerShell script to start all services
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting All Services" -ForegroundColor Cyan
Write-Host "  - Python Vectorize API (Port 5005)" -ForegroundColor Cyan
Write-Host "  - .NET Backend API (Port 5000)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Start Python API
Write-Host "[1/2] Starting Python API (Port 5005)..." -ForegroundColor Yellow
$pythonApiPath = Join-Path (Split-Path $scriptPath -Parent) "THITHI_python-api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pythonApiPath'; .\venv\Scripts\Activate.ps1; python app.py" -WindowStyle Normal

# Wait a bit for Python API to start
Write-Host "Waiting for Python API to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Start .NET Backend
Write-Host "[2/2] Starting .NET Backend API (Port 5000)..." -ForegroundColor Yellow
$backendPath = Join-Path $scriptPath "backend\THIHI_AI.Backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; dotnet run" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Python API:    http://localhost:5005" -ForegroundColor Cyan
Write-Host ".NET Backend:   http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: " -ForegroundColor Yellow
Write-Host "- Python API may take a few minutes to download model on first run" -ForegroundColor Gray
Write-Host "- Keep both windows open while using the application" -ForegroundColor Gray
Write-Host "- Press Ctrl+C in each window to stop the services" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
