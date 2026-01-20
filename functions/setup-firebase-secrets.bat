@echo off
setlocal enabledelayedexpansion
REM ============================================
REM Setup Environment từ Firebase Secrets
REM ============================================

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   Setup Environment từ Firebase
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
        echo.
        echo 💡 Thử login thủ công:
        echo    firebase login
        echo.
        pause
        exit /b 1
    )
    echo ✅ Đã login Firebase
) else (
    echo ✅ Firebase authenticated
)
echo.

REM Lấy GEMINI_API_KEY
echo 🔑 Lấy GEMINI_API_KEY từ Firebase...
for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i

if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  Không thể lấy GEMINI_API_KEY từ Firebase
    echo    (Có thể secret chưa được set hoặc chưa login)
    echo.
    
    REM Thử login Firebase nếu chưa login
    echo 💡 Đang thử login Firebase...
    firebase login --no-localhost >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Đã login Firebase
        echo.
        echo 🔑 Thử lấy GEMINI_API_KEY lại...
        for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i
    )
    
    if "%GEMINI_API_KEY%"=="" (
        echo ❌ Vẫn không thể lấy GEMINI_API_KEY
        echo.
        echo 💡 Cách khắc phục:
        echo    1. Set secret: echo YOUR_KEY ^| firebase functions:secrets:set GEMINI_API_KEY
        echo    2. Hoặc nhập thủ công bên dưới
        echo.
        set /p GEMINI_API_KEY="Nhập GEMINI_API_KEY thủ công: "
        if "%GEMINI_API_KEY%"=="" (
            echo ❌ GEMINI_API_KEY không được để trống
            exit /b 1
        )
    ) else (
        echo ✅ GEMINI_API_KEY đã được lấy sau khi login
    )
) else (
    echo ✅ GEMINI_API_KEY đã được lấy
)

echo.

REM Set FOLDER_PATH
if "%FOLDER_PATH%"=="" (
    set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
    echo ✅ FOLDER_PATH: %FOLDER_PATH% (mặc định)
    echo.
    set /p CHANGE_FOLDER="Muốn đổi FOLDER_PATH? (y/n): "
    if /i "!CHANGE_FOLDER!"=="y" (
        set /p FOLDER_PATH="Nhập FOLDER_PATH: "
    )
) else (
    echo ✅ FOLDER_PATH: %FOLDER_PATH%
)

echo.

REM Set SQL Server defaults
if "%SQL_SERVER_HOST%"=="" set SQL_SERVER_HOST=localhost
if "%SQL_SERVER_DATABASE%"=="" set SQL_SERVER_DATABASE=THITHI_AI
if "%SQL_SERVER_USER%"=="" set SQL_SERVER_USER=sa
if "%SQL_SERVER_PASSWORD%"=="" set SQL_SERVER_PASSWORD=123456

echo.
echo ============================================
echo   Environment Variables
echo ============================================
echo   GEMINI_API_KEY: Set ✅
echo   FOLDER_PATH: %FOLDER_PATH%
echo   SQL_SERVER_HOST: %SQL_SERVER_HOST%
echo   SQL_SERVER_DATABASE: %SQL_SERVER_DATABASE%
echo ============================================
echo.

echo 💡 Environment variables đã được set trong session này
echo.
echo 💡 Bây giờ bạn có thể chạy:
echo    ingest-folder.bat
echo    hoặc
echo    test-folder-ingest.bat
echo.

pause
