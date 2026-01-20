@echo off
REM Simple ingest script - no pauses, direct execution

REM Set environment variables
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_USER=sa
set SQL_SERVER_PASSWORD=123456
set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE

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
