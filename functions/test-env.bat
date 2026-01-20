@echo off
REM Test script để verify environment variables được truyền cho Node.js

echo ============================================
echo   Environment Variable Test
echo ============================================
echo.

REM Set test variables
set TEST_VAR=test_value_123
set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE

echo 📋 Variables set in batch file:
echo    TEST_VAR=%TEST_VAR%
echo    GEMINI_API_KEY=%GEMINI_API_KEY:~0,20%...
echo.

echo 🧪 Testing Node.js can read environment variables...
echo.

REM Create a simple Node.js script to test
echo console.log('TEST_VAR:', process.env.TEST_VAR); > test-env-check.js
echo console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : 'undefined'); >> test-env-check.js

REM Run Node.js
node test-env-check.js

REM Cleanup
del test-env-check.js

echo.
echo ============================================
if %ERRORLEVEL% EQU 0 (
    echo ✅ Test passed - Environment variables work correctly
) else (
    echo ❌ Test failed - Check Node.js installation
)
echo ============================================
echo.

pause
