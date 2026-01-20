@echo off
REM ============================================
REM Set GEMINI_API_KEY vào Firebase Secrets
REM ============================================

echo.
echo ============================================
echo   Set GEMINI_API_KEY vào Firebase
echo ============================================
echo.

REM Kiểm tra Firebase CLI
where firebase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Firebase CLI chưa được cài đặt
    echo.
    echo 💡 Cài đặt:
    echo    npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)

echo ✅ Firebase CLI found
echo.

REM Kiểm tra đã login chưa
firebase projects:list >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Chưa login Firebase
    echo.
    echo 🔑 Đang login Firebase...
    firebase login --no-localhost
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Login Firebase thất bại
        pause
        exit /b 1
    )
    echo ✅ Đã login Firebase
) else (
    echo ✅ Đã login Firebase
)
echo.

REM Set GEMINI_API_KEY
set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE

echo 🔑 Đang set GEMINI_API_KEY vào Firebase Secrets...
echo %GEMINI_API_KEY% | firebase functions:secrets:set GEMINI_API_KEY

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Đã set GEMINI_API_KEY vào Firebase thành công!
    echo.
    
    REM Test lấy lại
    echo 🔍 Đang test lấy GEMINI_API_KEY...
    for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set TEST_KEY=%%i
    
    if not "%TEST_KEY%"=="" (
        echo ✅ Có thể lấy GEMINI_API_KEY thành công!
        echo.
        echo 💡 Bây giờ bạn có thể chạy:
        echo    ingest-folder.bat
        echo    hoặc
        echo    chat-rag.bat
        echo.
    ) else (
        echo ⚠️  Đã set nhưng không thể lấy lại (có thể cần đợi vài giây)
        echo.
    )
) else (
    echo.
    echo ❌ Không thể set GEMINI_API_KEY vào Firebase
    echo.
    echo 💡 Kiểm tra:
    echo    1. Đã login Firebase chưa
    echo    2. Có quyền truy cập project không
    echo    3. Firebase CLI version có hỗ trợ secrets không
    echo.
)

pause
