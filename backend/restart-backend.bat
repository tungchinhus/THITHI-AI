@echo off
echo ========================================
echo   Rebuild va Restart Backend
echo ========================================
echo.

cd /d "%~dp0THIHI_AI.Backend"
if errorlevel 1 (
    echo ERROR: Khong tim thay thu muc THIHI_AI.Backend
    pause
    exit /b 1
)

echo [1/3] Dang clean project...
call dotnet clean
if errorlevel 1 (
    echo ERROR: Clean that bai
    pause
    exit /b 1
)

echo.
echo [2/3] Dang build project...
call dotnet build --configuration Release
if errorlevel 1 (
    echo ERROR: Build that bai. Kiem tra loi o tren.
    pause
    exit /b 1
)

echo.
echo [3/3] Dang khoi dong backend...
echo Backend se chay tai: http://localhost:5000
echo Nhan Ctrl+C de dung backend
echo.
call dotnet run --configuration Release

pause
