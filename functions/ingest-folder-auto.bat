@echo off
REM ============================================
REM Ingest Folder - Auto Setup từ Firebase
REM ============================================

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

REM ⚠️ CHỈNH SỬA ĐÂY: Set folder path của bạn
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA

echo.
echo ============================================
echo   RAG Folder Ingest - Auto Setup
echo ============================================
echo.

REM Bước 1: Kiểm tra và Setup Firebase
echo [1/3] Kiểm tra Firebase setup...
call check-firebase.bat
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Firebase setup thất bại
    echo.
    pause
    exit /b 1
)

REM Lấy GEMINI_API_KEY sau khi check
for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i

if "%GEMINI_API_KEY%"=="" (
    echo ❌ Không thể lấy GEMINI_API_KEY
    echo    Vui lòng chạy check-firebase.bat để fix
    pause
    exit /b 1
)

echo.
echo [2/3] Kiểm tra folder...
if not exist "%FOLDER_PATH%" (
    echo ❌ Folder không tồn tại: %FOLDER_PATH%
    echo.
    echo 💡 Chỉnh sửa FOLDER_PATH trong file này (dòng 6)
    pause
    exit /b 1
)

echo ✅ Folder tồn tại
echo.

REM Set SQL Server defaults
if "%SQL_SERVER_HOST%"=="" set SQL_SERVER_HOST=localhost
if "%SQL_SERVER_DATABASE%"=="" set SQL_SERVER_DATABASE=THITHI_AI
if "%SQL_SERVER_USER%"=="" set SQL_SERVER_USER=sa
if "%SQL_SERVER_PASSWORD%"=="" set SQL_SERVER_PASSWORD=123456

echo [3/3] Bắt đầu ingest...
echo.

REM Chạy ingest
node test-folder-ingest.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   ✅ HOÀN TẤT!
    echo ============================================
    echo.
    echo 💡 Bây giờ bạn có thể chat để tìm thông tin:
    echo    - Chạy: chat-rag.bat
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
