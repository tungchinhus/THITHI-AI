@echo off
echo ========================================
echo   Starting All Services
echo   - Python Vectorize API (Port 5005)
echo   - .NET Backend API (Port 5000)
echo ========================================
echo.

cd /d "%~dp0"

REM Start Python API trong cửa sổ mới
echo [1/2] Starting Python API (Port 5005)...
start "Python Vectorize API" cmd /k "cd /d %~dp0..\THITHI_python-api && call venv\Scripts\activate.bat && python app.py"

REM Đợi một chút để Python API khởi động
echo Waiting for Python API to start...
timeout /t 3 /nobreak >nul

REM Start .NET Backend trong cửa sổ mới
echo [2/2] Starting .NET Backend API (Port 5000)...
start ".NET Backend API" cmd /k "cd /d %~dp0backend\THIHI_AI.Backend && dotnet run"

echo.
echo ========================================
echo   Services Started!
echo ========================================
echo.
echo Python API:    http://localhost:5005
echo .NET Backend:   http://localhost:5000
echo.
echo NOTE: 
echo - Python API may take a few minutes to download model on first run
echo - Keep both windows open while using the application
echo - Press Ctrl+C in each window to stop the services
echo.
pause
