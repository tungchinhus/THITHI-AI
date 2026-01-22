@echo off
REM Simple ingest script - no pauses, direct execution

REM Set environment variables
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_USER=sa
set SQL_SERVER_PASSWORD=123456
REM ⚠️ BẢO MẬT: Không hardcode API key ở đây!
REM Sử dụng environment variable hoặc Firebase Secrets
if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  GEMINI_API_KEY chưa được set
    echo 💡 Set environment variable: set GEMINI_API_KEY=your_key_here
    echo    Hoặc sử dụng Firebase Secrets: firebase functions:secrets:access GEMINI_API_KEY
    exit /b 1
)

echo ============================================
echo   RAG Folder Ingest (Simple Version)
echo ============================================
echo.
echo Folder: %FOLDER_PATH%
echo SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
echo.
echo Starting ingest...
echo.

REM Run Node.js directly
node test-folder-ingest.js

echo.
echo Done. Exit code: %ERRORLEVEL%
