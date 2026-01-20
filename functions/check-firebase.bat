@echo off
REM ============================================
REM Kiểm tra và Fix Firebase Setup
REM ============================================

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment (để test)
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   Check Firebase Setup
echo ============================================
echo.

REM 1. Kiểm tra Firebase CLI
echo [1/4] Kiểm tra Firebase CLI...
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

REM 2. Kiểm tra đã login chưa
echo [2/4] Kiểm tra Firebase login...
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

REM 3. Kiểm tra GEMINI_API_KEY secret
echo [3/4] Kiểm tra GEMINI_API_KEY secret...
for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i

if "%GEMINI_API_KEY%"=="" (
    echo ❌ GEMINI_API_KEY secret chưa được set
    echo.
    echo 💡 Set secret:
    echo    echo YOUR_API_KEY ^| firebase functions:secrets:set GEMINI_API_KEY
    echo.
    set /p GEMINI_API_KEY="Nhập GEMINI_API_KEY để set vào Firebase (hoặc Enter để bỏ qua): "
    if not "%GEMINI_API_KEY%"=="" (
        echo %GEMINI_API_KEY% | firebase functions:secrets:set GEMINI_API_KEY
        if %ERRORLEVEL% EQU 0 (
            echo ✅ Đã set GEMINI_API_KEY vào Firebase
        ) else (
            echo ❌ Không thể set GEMINI_API_KEY
        )
    )
) else (
    echo ✅ GEMINI_API_KEY secret đã được set
    echo ✅ Có thể lấy được: %GEMINI_API_KEY:~0,20%...
)
echo.

REM 4. Test lấy GEMINI_API_KEY
echo [4/4] Test lấy GEMINI_API_KEY...
for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set TEST_KEY=%%i

if "%TEST_KEY%"=="" (
    echo ❌ Không thể lấy GEMINI_API_KEY từ Firebase
    echo.
    echo 💡 Có thể do:
    echo    1. Secret chưa được set
    echo    2. Không có quyền truy cập
    echo    3. Project chưa được chọn đúng
    echo.
    echo 💡 Thử:
    echo    firebase use --add
    echo    firebase functions:secrets:access GEMINI_API_KEY
    echo.
) else (
    echo ✅ Có thể lấy GEMINI_API_KEY thành công
    set GEMINI_API_KEY=%TEST_KEY%
)

echo.
echo ============================================
echo   Summary
echo ============================================
echo   Firebase CLI: ✅
echo   Firebase Login: ✅
if not "%GEMINI_API_KEY%"=="" (
    echo   GEMINI_API_KEY: ✅ (Set)
) else (
    echo   GEMINI_API_KEY: ❌ (Chưa set)
)
echo ============================================
echo.

if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  GEMINI_API_KEY chưa được set
    echo    Bạn có thể set thủ công: set GEMINI_API_KEY=your_key
    echo.
) else (
    echo ✅ Tất cả đã sẵn sàng!
    echo    Bây giờ bạn có thể chạy: ingest-folder.bat
    echo.
)

pause
