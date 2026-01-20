@echo off
echo Testing if statement...
dir "C:\MyData\P-TK\TBKT-25140T-250kVA" >nul 2>&1
echo ERRORLEVEL after dir: %ERRORLEVEL%
if %ERRORLEVEL% NEQ 0 (
    echo Folder not found
    pause
    exit /b 1
)
echo Folder check passed - continuing...
echo This should appear if folder exists
pause
