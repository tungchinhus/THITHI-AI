# Script đơn giản để set Gemini API Key
# Sử dụng: .\set-gemini-key.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Set Gemini API Key" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Firebase CLI
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseCmd = $null

# Thử firebase
try {
    $null = Get-Command firebase -ErrorAction Stop
    $firebaseCmd = "firebase"
    Write-Host "✅ Found: firebase" -ForegroundColor Green
} catch {
    # Thử npx firebase-tools
    try {
        $null = Get-Command npx -ErrorAction Stop
        $firebaseCmd = "npx firebase-tools"
        Write-Host "✅ Found: npx firebase-tools" -ForegroundColor Green
    } catch {
        Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Firebase CLI:" -ForegroundColor Yellow
        Write-Host "  npm install -g firebase-tools" -ForegroundColor White
        exit 1
    }
}

# Set API key
Write-Host ""
Write-Host "Setting API key..." -ForegroundColor Yellow
Write-Host "API Key: $($ApiKey.Substring(0, 20))..." -ForegroundColor Gray

try {
    $ApiKey | & $firebaseCmd functions:secrets:set GEMINI_API_KEY
    
    Write-Host ""
    Write-Host "✅ API key set successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Error setting API key: $_" -ForegroundColor Red
    exit 1
}

# Verify
Write-Host ""
Write-Host "Verifying..." -ForegroundColor Yellow
try {
    $result = & $firebaseCmd functions:secrets:access GEMINI_API_KEY 2>&1
    if ($result -match "AIzaSy") {
        Write-Host "✅ API key verified!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Could not verify API key" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not verify API key" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next step: Deploy functions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run: $firebaseCmd deploy --only functions" -ForegroundColor White
Write-Host ""
