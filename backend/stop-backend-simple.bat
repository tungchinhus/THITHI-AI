@echo off
echo ========================================
echo   Dung Backend - Tim Process Port 5000
echo ========================================
echo.

echo Dang tim process su dung port 5000...
netstat -ano | findstr :5000 | findstr LISTENING

echo.
echo Neu thay PID, chay lenh sau voi quyen Administrator:
echo taskkill /F /PID [PID]
echo.
echo Hoac dung Task Manager de dung process.
echo.

pause
