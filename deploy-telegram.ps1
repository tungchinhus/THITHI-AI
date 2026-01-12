# Deploy Telegram Authentication Functions
# PowerShell script for Windows

Write-Host "🚀 Deploying Telegram Authentication Functions..." -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is available
try {
    $firebaseVersion = firebase --version 2>&1
    Write-Host "✅ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
    Write-Host "💡 Install with: npm install -g firebase-tools" -ForegroundColor Yellow
    Write-Host "   Or use: npx firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
Write-Host "🔍 Checking Firebase login status..." -ForegroundColor Cyan
try {
    $projects = firebase projects:list 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Not logged in to Firebase!" -ForegroundColor Red
        Write-Host "💡 Run: firebase login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Logged in to Firebase" -ForegroundColor Green
} catch {
    Write-Host "❌ Error checking login status" -ForegroundColor Red
    exit 1
}

# Check if secret is set
Write-Host ""
Write-Host "🔍 Checking TELEGRAM_BOT_TOKEN secret..." -ForegroundColor Cyan
try {
    $secret = firebase functions:secrets:access TELEGRAM_BOT_TOKEN 2>&1
    if ($LASTEXITCODE -ne 0 -or $secret -match "not found" -or $secret -match "error") {
        Write-Host "❌ TELEGRAM_BOT_TOKEN secret not set!" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Set secret with one of these commands:" -ForegroundColor Yellow
        Write-Host "   firebase functions:secrets:set TELEGRAM_BOT_TOKEN" -ForegroundColor White
        Write-Host "   (will prompt for token)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   OR" -ForegroundColor Yellow
        Write-Host "   echo 'YOUR_BOT_TOKEN' | firebase functions:secrets:set TELEGRAM_BOT_TOKEN" -ForegroundColor White
        Write-Host ""
        $continue = Read-Host "Continue deployment anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            exit 1
        }
    } else {
        Write-Host "✅ Secret found" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not check secret (may not be set)" -ForegroundColor Yellow
    Write-Host "💡 Make sure to set secret before using functions" -ForegroundColor Yellow
}

# Deploy functions
Write-Host ""
Write-Host "📦 Deploying functions..." -ForegroundColor Cyan
Write-Host "   - telegramOnboarding" -ForegroundColor Gray
Write-Host "   - telegramLogin" -ForegroundColor Gray
Write-Host ""

firebase deploy --only functions:telegramOnboarding,functions:telegramLogin

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Functions deployed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Function deployment failed!" -ForegroundColor Red
    Write-Host "💡 Check logs above for details" -ForegroundColor Yellow
    exit 1
}

# Deploy Firestore rules
Write-Host ""
Write-Host "📋 Deploying Firestore rules..." -ForegroundColor Cyan

firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Firestore rules deployed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Firestore rules deployment failed (may not be critical)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Check Function URLs in output above" -ForegroundColor White
Write-Host "   2. Configure Telegram Bot with Mini App URL" -ForegroundColor White
Write-Host "   3. Create 'employees' collection in Firestore" -ForegroundColor White
Write-Host "   4. Test onboarding and login" -ForegroundColor White
Write-Host ""
Write-Host "📚 See HUONG_DAN_TELEGRAM_AUTH.md for details" -ForegroundColor Cyan
Write-Host ""
