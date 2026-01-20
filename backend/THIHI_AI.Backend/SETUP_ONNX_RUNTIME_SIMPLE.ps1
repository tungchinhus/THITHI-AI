# Setup ONNX Runtime for SQL Server 2025
# Simple version without Vietnamese characters to avoid encoding issues

$runtimePath = "C:\onnx_runtime"
$dllName = "onnxruntime.dll"
$sqlServiceAccount = "NT SERVICE\MSSQLSERVER"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup ONNX Runtime for SQL Server 2025" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create directory
Write-Host "Step 1: Create directory..." -ForegroundColor Yellow
if (-not (Test-Path $runtimePath)) {
    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
    Write-Host "OK: Created directory: $runtimePath" -ForegroundColor Green
} else {
    Write-Host "OK: Directory exists: $runtimePath" -ForegroundColor Green
}

# Step 2: Check ONNX Runtime DLL
Write-Host ""
Write-Host "Step 2: Check ONNX Runtime DLL..." -ForegroundColor Yellow
$dllPath = Join-Path $runtimePath $dllName

if (Test-Path $dllPath) {
    $dllInfo = Get-Item $dllPath
    Write-Host "OK: ONNX Runtime DLL found:" -ForegroundColor Green
    Write-Host "   Path: $dllPath" -ForegroundColor White
    Write-Host "   Size: $([math]::Round($dllInfo.Length / 1MB, 2)) MB" -ForegroundColor White
} else {
    Write-Host "WARNING: ONNX Runtime DLL not found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please download ONNX Runtime:" -ForegroundColor Cyan
    Write-Host "1. Visit: https://github.com/microsoft/onnxruntime/releases" -ForegroundColor White
    Write-Host "2. Download latest version (>= 1.19) for Windows x64" -ForegroundColor White
    Write-Host "3. Extract onnxruntime.dll" -ForegroundColor White
    Write-Host "4. Copy to: $dllPath" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Step 3: Set permissions
Write-Host ""
Write-Host "Step 3: Set permissions for SQL Server..." -ForegroundColor Yellow
try {
    $result = icacls $runtimePath /grant "${sqlServiceAccount}:(OI)(CI)R" /T 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: Permissions set for $sqlServiceAccount" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Could not set permissions automatically" -ForegroundColor Yellow
        Write-Host "Run manually as Administrator:" -ForegroundColor Cyan
        Write-Host "icacls `"$runtimePath`" /grant `"${sqlServiceAccount}:(OI)(CI)R`" /T" -ForegroundColor White
    }
} catch {
    Write-Host "WARNING: Error setting permissions: $_" -ForegroundColor Yellow
    Write-Host "Run manually as Administrator:" -ForegroundColor Cyan
    Write-Host "icacls `"$runtimePath`" /grant `"${sqlServiceAccount}:(OI)(CI)R`" /T" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DONE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run CREATE_ONNX_MODEL_WITH_RUNTIME.sql in SQL Server" -ForegroundColor White
Write-Host "2. Test with SQL query" -ForegroundColor White
Write-Host ""
