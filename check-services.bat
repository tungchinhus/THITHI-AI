@echo off
echo ========================================
echo   Checking Services Status
echo ========================================
echo.

echo Checking Python API (Port 5005)...
netstat -ano | findstr :5005 >nul
if %errorlevel% equ 0 (
    echo [OK] Python API is running
) else (
    echo [STOPPED] Python API is not running
)

echo.
echo Checking .NET Backend (Port 5000)...
netstat -ano | findstr :5000 >nul
if %errorlevel% equ 0 (
    echo [OK] .NET Backend is running
) else (
    echo [STOPPED] .NET Backend is not running
)

echo.
echo Testing endpoints...
echo.

echo Testing Python API health...
curl -s http://localhost:5005/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python API health check passed
) else (
    echo [ERROR] Python API health check failed
)

echo.
echo Testing .NET Backend health...
curl -s http://localhost:5000/api/vectorimport/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] .NET Backend health check passed
) else (
    echo [ERROR] .NET Backend health check failed
)

echo.
pause
