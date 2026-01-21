@echo off
chcp 65001 >nul 2>&1
REM Batch script để chạy test-rag-with-existing-data.js với environment variables

echo.
echo ============================================
echo   Test RAG với Existing Data
echo ============================================
echo.

REM Check và set SQL_SERVER_HOST
if "%SQL_SERVER_HOST%"=="" (
    echo ⚠️  SQL_SERVER_HOST chưa được set
    set /p SQL_SERVER_HOST_INPUT="Nhập SQL_SERVER_HOST (hoặc Enter để dùng 'localhost'): "
    if "%SQL_SERVER_HOST_INPUT%"=="" (
        set SQL_SERVER_HOST=localhost
        echo ✅ Dùng SQL_SERVER_HOST mặc định: localhost
    ) else (
        set SQL_SERVER_HOST=%SQL_SERVER_HOST_INPUT%
        echo ✅ SQL_SERVER_HOST đã được set: %SQL_SERVER_HOST%
    )
) else (
    echo ✅ SQL_SERVER_HOST: %SQL_SERVER_HOST%
)

REM Check và set SQL_SERVER_DATABASE (optional, có default)
if "%SQL_SERVER_DATABASE%"=="" (
    set SQL_SERVER_DATABASE=THITHI_AI
    echo ✅ SQL_SERVER_DATABASE: THITHI_AI (mặc định)
) else (
    echo ✅ SQL_SERVER_DATABASE: %SQL_SERVER_DATABASE%
)

REM Check và set GEMINI_API_KEY
if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  GEMINI_API_KEY chưa được set
    set /p GEMINI_API_KEY_INPUT="Nhập GEMINI_API_KEY: "
    if "%GEMINI_API_KEY_INPUT%"=="" (
        echo ❌ GEMINI_API_KEY là bắt buộc!
        echo    Lấy API key tại: https://makersuite.google.com/app/apikey
        pause
        exit /b 1
    ) else (
        set GEMINI_API_KEY=%GEMINI_API_KEY_INPUT%
        echo ✅ GEMINI_API_KEY đã được set
    )
) else (
    echo ✅ GEMINI_API_KEY: Đã set
)

echo.
echo 🚀 Đang chạy test script...
echo.

REM Chạy Node.js script
node test-rag-with-existing-data.js

REM Check exit code
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Test hoàn tất!
) else (
    echo.
    echo ❌ Test có lỗi (Exit code: %ERRORLEVEL%)
)

echo.
echo 💡 Tip: Để set environment variables trong CMD:
echo    set SQL_SERVER_HOST=localhost
echo    set GEMINI_API_KEY=your-api-key
echo.

pause
