@echo off
echo ========================================
echo   Start Services and Re-vectorize Data
echo ========================================
echo.

cd /d "%~dp0"

REM Check if Python API is running
echo [1/4] Checking Python API...
curl -s http://localhost:5005/health >nul 2>&1
if errorlevel 1 (
    echo Python API is not running. Starting it...
    start "Python Vectorize API" cmd /k "cd /d %~dp0..\..\python-api && call venv\Scripts\activate.bat && python app.py"
    echo Waiting for Python API to start...
    timeout /t 15 /nobreak >nul
    
    REM Check again
    curl -s http://localhost:5005/health >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Python API may still be starting. Model loading can take a few minutes.
        echo You can check manually: http://localhost:5005/health
    ) else (
        echo ✅ Python API is running
    )
) else (
    echo ✅ Python API is already running
)

echo.
echo [2/4] Checking Backend...
curl -s http://localhost:5000/api/vectorimport/health >nul 2>&1
if errorlevel 1 (
    echo Backend is not running. Starting it...
    start ".NET Backend API" cmd /k "cd /d %~dp0THIHI_AI.Backend && dotnet run --launch-profile http"
    echo Waiting for Backend to start...
    timeout /t 5 /nobreak >nul
) else (
    echo ✅ Backend is already running
)

echo.
echo [3/4] Waiting a bit for services to be ready...
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Starting re-vectorize...
echo.

if "%1"=="" (
    set TABLENAME=TSMay
    echo No table name provided, using default: TSMay
) else (
    set TABLENAME=%1
    echo Using table name: %TABLENAME%
)

echo.
powershell -ExecutionPolicy Bypass -File "%~dp0revectorize-data.ps1" -TableName "%TABLENAME%"

echo.
echo ========================================
echo   Done!
echo ========================================
pause
