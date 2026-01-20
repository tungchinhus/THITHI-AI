@echo off
echo ========================================
echo   Starting .NET Backend API
echo ========================================
echo.

cd /d "%~dp0THIHI_AI.Backend"
if errorlevel 1 (
    echo ERROR: Khong tim thay thu muc THIHI_AI.Backend
    pause
    exit /b 1
)

echo Checking .NET SDK...
dotnet --version
if errorlevel 1 (
    echo ERROR: .NET SDK khong tim thay. Vui long cai dat .NET SDK 9.0
    pause
    exit /b 1
)

echo.
echo Building project...
dotnet build
if errorlevel 1 (
    echo ERROR: Build that bai. Kiem tra loi o tren.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Starting Backend...
echo ========================================
echo Backend se chay tai: http://localhost:5000
echo Nhan Ctrl+C de dung backend
echo.

dotnet run --launch-profile http

pause
