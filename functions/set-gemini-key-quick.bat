@echo off
REM ============================================
REM Quick Set GEMINI_API_KEY vào Firebase
REM ============================================

set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE

echo.
echo 🔑 Đang set GEMINI_API_KEY vào Firebase...
echo %GEMINI_API_KEY% | firebase functions:secrets:set GEMINI_API_KEY

if %ERRORLEVEL% EQU 0 (
    echo ✅ Đã set thành công!
    echo.
    echo 💡 Bây giờ chạy: ingest-folder.bat
) else (
    echo ❌ Set thất bại. Thử chạy: set-gemini-key.bat
)

echo.
pause
