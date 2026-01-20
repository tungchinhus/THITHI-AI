@echo off
REM ============================================
REM Setup Environment Variables cho RAG System
REM ============================================

echo.
echo ============================================
echo   Setup Environment Variables
echo ============================================
echo.

REM Set GEMINI_API_KEY
echo Nhập GEMINI_API_KEY (hoặc Enter để bỏ qua):
set /p GEMINI_API_KEY_INPUT=
if not "%GEMINI_API_KEY_INPUT%"=="" (
    set GEMINI_API_KEY=%GEMINI_API_KEY_INPUT%
    echo ✅ GEMINI_API_KEY đã được set
) else (
    echo ⚠️  GEMINI_API_KEY không được set
)

echo.

REM Set FOLDER_PATH
echo Nhập FOLDER_PATH (hoặc Enter để dùng mặc định):
echo Ví dụ: C:\MyData\P-TK\TBKT-25140T-250kVA
set /p FOLDER_PATH_INPUT=
if not "%FOLDER_PATH_INPUT%"=="" (
    set FOLDER_PATH=%FOLDER_PATH_INPUT%
    echo ✅ FOLDER_PATH đã được set: %FOLDER_PATH%
) else (
    set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
    echo ✅ Dùng FOLDER_PATH mặc định: %FOLDER_PATH%
)

echo.

REM Set SQL Server config
echo Nhập SQL_SERVER_HOST (hoặc Enter để dùng localhost):
set /p SQL_SERVER_HOST_INPUT=
if not "%SQL_SERVER_HOST_INPUT%"=="" (
    set SQL_SERVER_HOST=%SQL_SERVER_HOST_INPUT%
    echo ✅ SQL_SERVER_HOST đã được set: %SQL_SERVER_HOST%
) else (
    set SQL_SERVER_HOST=localhost
    echo ✅ Dùng SQL_SERVER_HOST mặc định: localhost
)

echo.

echo Nhập SQL_SERVER_DATABASE (hoặc Enter để dùng THITHI_AI):
set /p SQL_SERVER_DATABASE_INPUT=
if not "%SQL_SERVER_DATABASE_INPUT%"=="" (
    set SQL_SERVER_DATABASE=%SQL_SERVER_DATABASE_INPUT%
    echo ✅ SQL_SERVER_DATABASE đã được set: %SQL_SERVER_DATABASE%
) else (
    set SQL_SERVER_DATABASE=THITHI_AI
    echo ✅ Dùng SQL_SERVER_DATABASE mặc định: THITHI_AI
)

echo.

REM Optional: SQL Auth
echo Có dùng SQL Server Authentication? (y/n, mặc định: n - dùng Windows Auth):
set /p USE_SQL_AUTH=
if /i "%USE_SQL_AUTH%"=="y" (
    echo Nhập SQL_SERVER_USER:
    set /p SQL_SERVER_USER=
    echo Nhập SQL_SERVER_PASSWORD:
    set /p SQL_SERVER_PASSWORD=
    echo ✅ SQL Server Authentication đã được set
) else (
    echo ✅ Sẽ dùng Windows Authentication
)

echo.
echo ============================================
echo   Environment Variables Summary
echo ============================================
echo   GEMINI_API_KEY: %GEMINI_API_KEY%
echo   FOLDER_PATH: %FOLDER_PATH%
echo   SQL_SERVER_HOST: %SQL_SERVER_HOST%
echo   SQL_SERVER_DATABASE: %SQL_SERVER_DATABASE%
if not "%SQL_SERVER_USER%"=="" (
    echo   SQL_SERVER_USER: %SQL_SERVER_USER%
    echo   SQL_SERVER_PASSWORD: ***
)
echo ============================================
echo.

echo 💡 Để lưu các biến này, chạy test-folder-ingest.bat ngay sau đó
echo    hoặc set lại trong PowerShell/CMD session
echo.

pause
