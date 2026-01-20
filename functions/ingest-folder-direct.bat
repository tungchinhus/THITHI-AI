@echo off
chcp 65001 >nul 2>&1
REM Direct ingest script - no checks, just run Node.js

set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_USER=sa
set SQL_SERVER_PASSWORD=123456

if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   RAG Folder Ingest (Direct Version)
echo ============================================
echo.
echo 📁 Folder: %FOLDER_PATH%
echo ✅ GEMINI_API_KEY: Set
echo ✅ SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
echo ✅ SQL User: %SQL_SERVER_USER%
echo.
echo 🚀 Bắt đầu ingest...
echo.

node test-folder-ingest.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ HOÀN TẤT!
) else (
    echo.
    echo ❌ LỖI - Exit code: %ERRORLEVEL%
)

pause
