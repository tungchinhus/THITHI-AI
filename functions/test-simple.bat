@echo off
echo Test script starting...
echo [DEBUG] After first echo
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
echo [DEBUG] FOLDER_PATH set to: %FOLDER_PATH%
echo [DEBUG] About to check folder...
if not exist "%FOLDER_PATH%" (
    echo [DEBUG] Folder does not exist
    pause
    exit /b 1
)
echo [DEBUG] Folder exists - check passed
echo ✅ Folder tồn tại
echo Script completed!
pause
