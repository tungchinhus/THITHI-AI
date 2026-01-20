@echo off
REM ============================================
REM Wrapper script để đảm bảo environment variables được set đúng
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

REM Verify và hiển thị
echo ============================================
echo   Environment Variables Check
echo ============================================
echo FOLDER_PATH=%FOLDER_PATH%
echo GEMINI_API_KEY=%GEMINI_API_KEY:~0,20%...
echo SQL_SERVER_HOST=%SQL_SERVER_HOST%
echo SQL_SERVER_DATABASE=%SQL_SERVER_DATABASE%
echo SQL_SERVER_USER=%SQL_SERVER_USER%
echo ============================================
echo.

REM Chạy Node.js với environment variables được set
REM Sử dụng cmd /c để đảm bảo environment được truyền đúng
cmd /c "node test-folder-ingest.js"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ HOÀN TẤT!
) else (
    echo.
    echo ❌ LỖI - Kiểm tra lại các biến môi trường ở trên
)

pause
