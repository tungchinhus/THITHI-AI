@echo off
echo ========================================
echo   Stopping All Services
echo ========================================
echo.

echo Stopping Python API (Port 5005)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5005') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Stopping .NET Backend (Port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Done! All services stopped.
echo.
pause
