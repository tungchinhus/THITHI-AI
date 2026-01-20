@echo off
chcp 65001 >nul 2>&1
REM ============================================
REM Robust Ingest Folder Script
REM Hoạt động cả khi chạy từ CMD và PowerShell
REM ============================================

REM Set tất cả biến môi trường cần thiết
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_USER=sa
set SQL_SERVER_PASSWORD=123456

REM Set GEMINI_API_KEY với fallback
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

REM Thử lấy từ Firebase nếu chưa có
if "%GEMINI_API_KEY%"=="" (
    where firebase >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i
    )
)

echo.
echo ============================================
echo   RAG Folder Ingest (Robust Version)
echo ============================================
echo.
echo 📁 Folder: %FOLDER_PATH%
echo.

REM Verify GEMINI_API_KEY
if "%GEMINI_API_KEY%"=="" (
    echo ❌ GEMINI_API_KEY không được set
    echo.
    echo 💡 Cách khắc phục:
    echo    1. Set trong CMD: set GEMINI_API_KEY=your_key
    echo    2. Set trong PowerShell: $env:GEMINI_API_KEY="your_key"
    echo    3. Chạy set-gemini-key.bat để set vào Firebase
    echo.
    pause
    exit /b 1
)

echo ✅ GEMINI_API_KEY: Set (Length: %GEMINI_API_KEY:~0,20%...)
echo ✅ SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
echo ✅ SQL User: %SQL_SERVER_USER%
echo.
if not exist "%FOLDER_PATH%" (
    echo ❌ Folder không tồn tại: %FOLDER_PATH%
    pause
    exit /b 1
)
echo ✅ Folder tồn tại
echo.
echo 🚀 Bắt đầu ingest...
echo.

REM Verify environment variables trước khi chạy Node.js
echo 📋 Environment Variables (sẽ được truyền cho Node.js):
echo    FOLDER_PATH=%FOLDER_PATH%
echo    GEMINI_API_KEY=%GEMINI_API_KEY:~0,20%...
echo    SQL_SERVER_HOST=%SQL_SERVER_HOST%
echo    SQL_SERVER_DATABASE=%SQL_SERVER_DATABASE%
echo    SQL_SERVER_USER=%SQL_SERVER_USER%
echo    SQL_SERVER_PASSWORD=*** (hidden)
echo.
echo [DEBUG] About to check Node.js...

REM Kiểm tra Node.js có sẵn không
echo [DEBUG] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js không được tìm thấy trong PATH
    echo.
    echo 💡 Cài Node.js: https://nodejs.org/
    pause
    exit /b 1
)
echo [DEBUG] Node.js found

REM Kiểm tra file script có tồn tại không
echo [DEBUG] Checking test-folder-ingest.js...
if not exist "test-folder-ingest.js" (
    echo ❌ File test-folder-ingest.js không tồn tại
    echo.
    echo 💡 Đảm bảo bạn đang chạy từ thư mục functions
    pause
    exit /b 1
)
echo [DEBUG] test-folder-ingest.js exists

REM Chạy Node.js với environment variables
echo [DEBUG] About to run Node.js script...
echo.
echo 🔄 Starting Node.js script...
echo [DEBUG] Command: node test-folder-ingest.js
echo [DEBUG] Current directory: %CD%
echo.

node test-folder-ingest.js
set NODE_EXIT_CODE=%ERRORLEVEL%
echo.
echo 📊 Node.js script exit code: %NODE_EXIT_CODE%

if %NODE_EXIT_CODE% EQU 0 (
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
    echo    4. Xem log tại: .cursor\debug.log
    echo.
)

pause
