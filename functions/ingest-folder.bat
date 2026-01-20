@echo off
chcp 65001 >nul 2>&1
REM ============================================
REM Ingest Folder vào RAG System - Quick Start
REM ============================================

REM ⚠️ CHỈNH SỬA ĐÂY: Set folder path của bạn
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

REM ⚠️ GEMINI_API_KEY: Lấy từ Firebase Functions
REM Cách 1: Chạy get-firebase-secrets.bat trước
REM Cách 2: Set thủ công: set GEMINI_API_KEY=your_key
REM Cách 3: Lấy từ Firebase: firebase functions:secrets:access GEMINI_API_KEY

echo.
echo ============================================
echo   RAG Folder Ingest
echo ============================================
echo.
echo 📁 Folder: %FOLDER_PATH%
echo.

REM Kiểm tra GEMINI_API_KEY - Ưu tiên environment variable, sau đó lấy từ Firebase
if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  GEMINI_API_KEY chưa được set trong environment
    echo.
    echo 🔑 Đang thử lấy từ Firebase Secrets...
    echo.
    
    REM Kiểm tra Firebase CLI
    where firebase >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        REM Kiểm tra đã login chưa
        firebase projects:list >nul 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo ⚠️  Chưa login Firebase, đang thử login...
            firebase login --no-localhost >nul 2>&1
        )
        
        REM Thử lấy từ Firebase
        for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i
        
        if not "%GEMINI_API_KEY%"=="" (
            echo ✅ Đã lấy GEMINI_API_KEY từ Firebase
            echo.
        ) else (
            echo ❌ Không thể lấy GEMINI_API_KEY từ Firebase
            echo.
            echo 💡 Cách khắc phục:
            echo    1. Set trong terminal: set GEMINI_API_KEY=your_key
            echo    2. Chạy set-gemini-key.bat để set vào Firebase
            echo    3. Hoặc chạy setup-firebase-secrets.bat
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo ❌ Firebase CLI chưa được cài đặt
        echo.
        echo 💡 Cách khắc phục:
        echo    1. Set trong terminal: set GEMINI_API_KEY=your_key
        echo    2. Cài Firebase CLI: npm install -g firebase-tools
        echo.
        pause
        exit /b 1
    )
) else (
    echo [OK] GEMINI_API_KEY is set in environment
    echo.
)

REM Kiểm tra folder
if not exist "%FOLDER_PATH%" (
    echo ❌ Folder không tồn tại: %FOLDER_PATH%
    echo.
    echo 💡 Chỉnh sửa FOLDER_PATH trong file này (dòng 6)
    pause
    exit /b 1
)

echo ✅ Folder tồn tại
if not "%GEMINI_API_KEY%"=="" (
    echo ✅ GEMINI_API_KEY: Set (Length: %GEMINI_API_KEY:~0,20%...)
) else (
    echo ❌ GEMINI_API_KEY: Not set
)
echo ✅ SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
echo ✅ SQL User: %SQL_SERVER_USER%
echo.
echo 🚀 Bắt đầu ingest...
echo.

REM Set SQL Server defaults
if "%SQL_SERVER_HOST%"=="" set SQL_SERVER_HOST=localhost
if "%SQL_SERVER_DATABASE%"=="" set SQL_SERVER_DATABASE=THITHI_AI
if "%SQL_SERVER_USER%"=="" set SQL_SERVER_USER=sa
if "%SQL_SERVER_PASSWORD%"=="" set SQL_SERVER_PASSWORD=123456

REM Verify environment variables will be passed to Node.js
echo.
echo 📋 Environment Variables (sẽ được truyền cho Node.js):
echo    FOLDER_PATH=%FOLDER_PATH%
echo    GEMINI_API_KEY=%GEMINI_API_KEY:~0,20%...
echo    SQL_SERVER_HOST=%SQL_SERVER_HOST%
echo    SQL_SERVER_DATABASE=%SQL_SERVER_DATABASE%
echo    SQL_SERVER_USER=%SQL_SERVER_USER%
echo.

REM Chạy ingest với environment variables được set
REM Batch file chạy trong CMD context, nên Node.js sẽ tự động inherit environment variables
node test-folder-ingest.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   ✅ HOÀN TẤT!
    echo ============================================
    echo.
    echo 💡 Bây giờ bạn có thể chat để tìm thông tin:
    echo    - Chạy: test-rag-chat.bat
    echo    - Hoặc gọi API: POST /ragChat
    echo.
) else (
    echo.
    echo ============================================
    echo   ❌ LỖI
    echo ============================================
    echo.
    echo 💡 Kiểm tra:
    echo    1. GEMINI_API_KEY đúng chưa
    echo    2. SQL Server đang chạy
    echo    3. Folder có files (PDF, Word, Excel, TXT)
    echo.
)

pause
