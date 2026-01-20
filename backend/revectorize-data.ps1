# Script để re-vectorize data đã import nhưng chưa có vector
# Sử dụng: .\revectorize-data.ps1 -TableName "TSMay"

param(
    [Parameter(Mandatory=$true)]
    [string]$TableName = "TSMay"
)

$backendUrl = "http://localhost:5000"
$pythonApiUrl = "http://localhost:5005"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Re-vectorize Data Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Python API
Write-Host "Checking Python API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$pythonApiUrl/health" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $health = $response.Content | ConvertFrom-Json
    if ($health.model_loaded) {
        Write-Host "✅ Python API is running and model is loaded" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Python API is running but model is not loaded yet" -ForegroundColor Yellow
        Write-Host "   Please wait for model to load..." -ForegroundColor Yellow
        Write-Host "   Continuing anyway..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Python API is NOT running or not responding!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Please start Python API first:" -ForegroundColor Yellow
    Write-Host "   cd d:\Project\thibidi\THITHI\python-api" -ForegroundColor White
    Write-Host "   start-service.bat" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Kiểm tra Backend
Write-Host ""
Write-Host "Checking Backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/vectorimport/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is NOT running!" -ForegroundColor Red
    Write-Host "   Please start Backend first:" -ForegroundColor Yellow
    Write-Host "   cd d:\Project\thibidi\THITHI\THITHI-AI\backend" -ForegroundColor White
    Write-Host "   start-backend.bat" -ForegroundColor White
    exit 1
}

# Gọi endpoint re-vectorize
Write-Host ""
Write-Host "Starting re-vectorize for table: $TableName" -ForegroundColor Cyan
Write-Host "This may take a while depending on the number of records..." -ForegroundColor Yellow
Write-Host ""

try {
    $body = @{
        tableName = $TableName
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$backendUrl/api/vectorimport/revectorize" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing

    $result = $response.Content | ConvertFrom-Json

    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Re-vectorize Completed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Table: $($result.tableName)" -ForegroundColor White
    Write-Host "Processed: $($result.processedCount) records" -ForegroundColor White
    Write-Host "Success: $($result.successCount) records" -ForegroundColor Green
    Write-Host "Errors: $($result.errorCount) records" -ForegroundColor $(if ($result.errorCount -gt 0) { "Red" } else { "Green" })
    Write-Host ""

    if ($result.errorCount -gt 0) {
        Write-Host "⚠️  Some records failed. Check backend logs for details." -ForegroundColor Yellow
    } else {
        Write-Host "✅ All records processed successfully!" -ForegroundColor Green
    }

} catch {
    Write-Host "❌ Error calling re-vectorize endpoint:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
    
    exit 1
}

Write-Host ""
Write-Host "Done! You can now check the database to see the vectors." -ForegroundColor Cyan
