@echo off
chcp 65001 >nul 2>&1
REM Simple Ingest Folder Script - No emoji, safe encoding

REM Set environment variables
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_USER=sa
set SQL_SERVER_PASSWORD=123456

REM Set GEMINI_API_KEY if not already set
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   RAG Folder Ingest
echo ============================================
echo.
echo Folder: %FOLDER_PATH%
echo.

REM Check GEMINI_API_KEY
if "%GEMINI_API_KEY%"=="" (
    echo ERROR: GEMINI_API_KEY not set
    echo.
    echo Fix: set GEMINI_API_KEY=your_key
    echo.
    pause
    exit /b 1
)

echo GEMINI_API_KEY: Set (Length: %GEMINI_API_KEY:~0,20%...)
echo SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
echo SQL User: %SQL_SERVER_USER%
echo.

REM Check folder exists
if not exist "%FOLDER_PATH%" (
    echo ERROR: Folder does not exist: %FOLDER_PATH%
    pause
    exit /b 1
)

echo Folder exists
echo.
echo Starting ingest...
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found in PATH
    echo.
    echo Fix: Install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check script file exists
if not exist "test-folder-ingest.js" (
    echo ERROR: test-folder-ingest.js not found
    echo.
    echo Fix: Make sure you are running from the functions directory
    pause
    exit /b 1
)

REM Run Node.js script
node test-folder-ingest.js
set NODE_EXIT_CODE=%ERRORLEVEL%

echo.
echo Node.js exit code: %NODE_EXIT_CODE%

if %NODE_EXIT_CODE% EQU 0 (
    echo.
    echo ============================================
    echo   SUCCESS!
    echo ============================================
    echo.
    echo You can now chat to find information
    echo.
) else (
    echo.
    echo ============================================
    echo   ERROR
    echo ============================================
    echo.
    echo Check:
    echo   1. GEMINI_API_KEY is correct
    echo   2. SQL Server is running
    echo   3. Folder has files (PDF, Word, Excel, TXT)
    echo   4. See log at: .cursor\debug.log
    echo.
)

pause
