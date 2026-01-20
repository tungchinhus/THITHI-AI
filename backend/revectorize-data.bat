@echo off
echo ========================================
echo   Re-vectorize Data Script
echo ========================================
echo.

if "%1"=="" (
    echo Usage: revectorize-data.bat [TableName]
    echo Example: revectorize-data.bat TSMay
    echo.
    set /p TABLENAME="Enter table name (default: TSMay): "
    if "!TABLENAME!"=="" set TABLENAME=TSMay
) else (
    set TABLENAME=%1
)

echo.
echo Re-vectorizing table: %TABLENAME%
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0revectorize-data.ps1" -TableName "%TABLENAME%"

pause
