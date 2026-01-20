@echo off
REM ============================================
REM Lấy GEMINI_API_KEY từ Firebase Secrets
REM ============================================

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có (để test)
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   Get Firebase Secrets
echo ============================================
echo.

REM Kiểm tra Firebase CLI
where firebase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Firebase CLI chưa được cài đặt
    echo.
    echo 💡 Cài đặt Firebase CLI:
    echo    npm install -g firebase-tools
    echo.
    echo Hoặc lấy GEMINI_API_KEY từ Firebase Console:
    echo    1. Vào Firebase Console ^> Functions ^> Secrets
    echo    2. Copy GEMINI_API_KEY value
    echo    3. Set: set GEMINI_API_KEY=your_key
    echo.
    pause
    exit /b 1
)

echo ✅ Firebase CLI found
echo.

REM Kiểm tra đã login Firebase chưa
firebase projects:list >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Chưa login Firebase
    echo.
    echo 💡 Login Firebase:
    echo    firebase login
    echo.
    pause
    exit /b 1
)

echo ✅ Firebase authenticated
echo.

REM Lấy GEMINI_API_KEY
echo 🔑 Đang lấy GEMINI_API_KEY từ Firebase Secrets...
echo.

for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i

if "%GEMINI_API_KEY%"=="" (
    echo ❌ Không thể lấy GEMINI_API_KEY từ Firebase
    echo.
    echo 💡 Kiểm tra:
    echo    1. Đã set secret trong Firebase chưa: firebase functions:secrets:set GEMINI_API_KEY
    echo    2. Đã login Firebase chưa: firebase login
    echo    3. Đang ở đúng project chưa: firebase use
    echo.
    pause
    exit /b 1
)

echo ✅ GEMINI_API_KEY đã được lấy từ Firebase
echo.
echo 📋 Environment Variables:
echo    GEMINI_API_KEY: Set ✅
echo.

REM Lưu vào file .env.local (optional)
echo 💡 Để lưu GEMINI_API_KEY, chạy:
echo    set GEMINI_API_KEY=%GEMINI_API_KEY%
echo.
echo Hoặc export trong session hiện tại:
echo    set GEMINI_API_KEY=%GEMINI_API_KEY%
echo.

REM Set trong session hiện tại
set GEMINI_API_KEY=%GEMINI_API_KEY%

echo ✅ GEMINI_API_KEY đã được set trong session hiện tại
echo.
echo 💡 Bây giờ bạn có thể chạy:
echo    ingest-folder.bat
echo    hoặc
echo    test-folder-ingest.bat
echo.

pause
