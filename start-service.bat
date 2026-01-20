@echo off
echo ========================================
echo Starting Angular Frontend Service
echo ========================================
echo.

cd /d "%~dp0"

REM Check if node_modules exists or if xlsx is missing
if not exist "node_modules" (
    echo node_modules not found!
    echo Installing dependencies...
    call npm install
    echo.
) else (
    REM Check if xlsx package exists
    if not exist "node_modules\xlsx" (
        echo xlsx package not found in node_modules!
        echo Installing missing dependencies...
        call npm install
        echo.
    )
)

REM Verify xlsx installation
echo Verifying xlsx package...
call npm list xlsx >nul 2>&1
if errorlevel 1 (
    echo WARNING: xlsx package check failed, reinstalling...
    call npm install xlsx @types/xlsx --save
    echo.
)

echo.
echo ========================================
echo Starting Angular Development Server...
echo ========================================
echo.
echo Service will be available at: http://localhost:4200
echo Press Ctrl+C to stop
echo.

call npm start

pause
