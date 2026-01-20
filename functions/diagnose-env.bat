@echo off
REM ============================================
REM Diagnostic Script - Kiểm tra Environment Variables
REM ============================================

echo.
echo ============================================
echo   Environment Variables Diagnostic
echo ============================================
echo.

echo 📋 Checking environment variables in CMD context:
echo.
echo    GEMINI_API_KEY=%GEMINI_API_KEY%
echo    SQL_SERVER_HOST=%SQL_SERVER_HOST%
echo    SQL_SERVER_DATABASE=%SQL_SERVER_DATABASE%
echo    SQL_SERVER_USER=%SQL_SERVER_USER%
echo    FOLDER_PATH=%FOLDER_PATH%
echo.

REM Set test variables
set TEST_VAR_CMD=test_value_from_cmd
set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_USER=sa
set SQL_SERVER_PASSWORD=123456
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA

echo 📋 After setting variables in batch file:
echo.
echo    TEST_VAR_CMD=%TEST_VAR_CMD%
echo    GEMINI_API_KEY=%GEMINI_API_KEY:~0,20%...
echo    SQL_SERVER_HOST=%SQL_SERVER_HOST%
echo    SQL_SERVER_DATABASE=%SQL_SERVER_DATABASE%
echo    SQL_SERVER_USER=%SQL_SERVER_USER%
echo    FOLDER_PATH=%FOLDER_PATH%
echo.

echo 🧪 Testing Node.js can read environment variables...
echo.

REM Run Node.js with pre-written diagnostic script
REM (test-env-diagnostic.js is a static file to avoid batch syntax issues)
node test-env-diagnostic.js
set NODE_EXIT_CODE=%ERRORLEVEL%

echo.
echo ============================================
if %NODE_EXIT_CODE% EQU 0 (
    echo ✅ DIAGNOSTIC PASSED
    echo    Environment variables are being passed correctly to Node.js
) else (
    echo ❌ DIAGNOSTIC FAILED
    echo    Node.js cannot read environment variables set in batch file
    echo.
    echo 💡 Possible causes:
    echo    1. Batch file is being called from PowerShell (use ingest-folder.ps1 instead)
    echo    2. Node.js is not in PATH
    echo    3. Environment variables are being cleared before Node.js runs
)
echo ============================================
echo.

pause
