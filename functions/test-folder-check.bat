@echo off
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
echo Testing folder check...
echo [DEBUG] Checking if folder exists: %FOLDER_PATH%
echo [DEBUG] About to test if not exist...
if not exist "%FOLDER_PATH%" (
    echo [DEBUG] Folder does not exist
    pause
    exit /b 1
)
echo [DEBUG] Folder exists - check passed
echo ✅ Folder tồn tại
echo Script completed successfully!
pause
