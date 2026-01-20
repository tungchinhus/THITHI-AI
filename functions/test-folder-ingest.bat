@echo off
REM ============================================
REM Test Script để Ingest Folder vào RAG System
REM ============================================

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   RAG Folder Ingest Test
echo ============================================
echo.

REM Kiểm tra folder path
if "%FOLDER_PATH%"=="" (
    echo ⚠️  FOLDER_PATH chưa được set
    echo.
    echo 💡 Cách 1: Set environment variable trước:
    echo    set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
    echo    test-folder-ingest.bat
    echo.
    echo 💡 Cách 2: Chỉnh sửa file này và set FOLDER_PATH bên dưới
    echo.
    
    REM Set default folder path (chỉnh sửa đây)
    set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
    echo ✅ Đang dùng folder mặc định: %FOLDER_PATH%
    echo.
)

REM Kiểm tra GEMINI_API_KEY - Tự động lấy từ Firebase nếu chưa có
if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  GEMINI_API_KEY chưa được set
    echo.
    echo 🔑 Đang thử lấy từ Firebase Secrets...
    echo.
    
    REM Kiểm tra Firebase CLI
    where firebase >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        REM Thử lấy từ Firebase
        for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i
        
        if not "%GEMINI_API_KEY%"=="" (
            echo ✅ Đã lấy GEMINI_API_KEY từ Firebase
            echo.
        ) else (
            echo ❌ Không thể lấy GEMINI_API_KEY từ Firebase
            echo.
            echo 💡 Cách khắc phục:
            echo    1. Chạy setup-firebase-secrets.bat trước
            echo    2. Hoặc login Firebase: firebase login
            echo    3. Hoặc set thủ công: set GEMINI_API_KEY=your_key
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo ❌ Firebase CLI chưa được cài đặt
        echo.
        echo 💡 Cách khắc phục:
        echo    1. Cài Firebase CLI: npm install -g firebase-tools
        echo    2. Hoặc chạy setup-firebase-secrets.bat
        echo    3. Hoặc set thủ công: set GEMINI_API_KEY=your_key
        echo.
        pause
        exit /b 1
    )
)

REM Kiểm tra SQL Server config
if "%SQL_SERVER_HOST%"=="" (
    echo ⚠️  SQL_SERVER_HOST chưa được set, dùng mặc định: localhost
    set SQL_SERVER_HOST=localhost
)

if "%SQL_SERVER_DATABASE%"=="" (
    echo ⚠️  SQL_SERVER_DATABASE chưa được set, dùng mặc định: THITHI_AI
    set SQL_SERVER_DATABASE=THITHI_AI
)

if "%SQL_SERVER_USER%"=="" (
    set SQL_SERVER_USER=sa
)

if "%SQL_SERVER_PASSWORD%"=="" (
    set SQL_SERVER_PASSWORD=123456
)

echo 📋 Configuration:
echo    Folder: %FOLDER_PATH%
echo    SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
echo    SQL User: %SQL_SERVER_USER%
echo    GEMINI_API_KEY: Set ✅
echo.

REM Kiểm tra folder tồn tại
if not exist "%FOLDER_PATH%" (
    echo ❌ Folder không tồn tại: %FOLDER_PATH%
    echo.
    echo 💡 Kiểm tra lại đường dẫn folder
    pause
    exit /b 1
)

echo ✅ Folder tồn tại
echo.

REM Chạy test
echo 🚀 Bắt đầu ingest folder...
echo.

node test-folder-ingest.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   ✅ Ingest thành công!
    echo ============================================
    echo.
    echo 💡 Bây giờ bạn có thể chat với RAG system để tìm thông tin
    echo    trong folder này qua endpoint /ragChat
    echo.
) else (
    echo.
    echo ============================================
    echo   ❌ Ingest thất bại
    echo ============================================
    echo.
    echo 💡 Kiểm tra:
    echo    1. GEMINI_API_KEY đã đúng chưa
    echo    2. SQL Server đang chạy chưa
    echo    3. Folder có files hỗ trợ không (PDF, Word, Excel, TXT)
    echo.
)

pause
