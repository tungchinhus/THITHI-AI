@echo off
echo ========================================
echo   Dung Backend (.NET)
echo ========================================
echo.

echo Dang tim cac process .NET...
for /f "tokens=2" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    set PID=%%a
    echo Tim thay process PID: %%a
    taskkill /F /PID %%a 2>nul
    if errorlevel 1 (
        echo Khong the dung process %%a (co the can quyen Admin)
    ) else (
        echo Da dung process %%a
    )
)

echo.
echo Dang tim cac process dotnet...
taskkill /F /IM dotnet.exe 2>nul
if errorlevel 1 (
    echo Khong co process dotnet nao dang chay hoac khong the dung (co the can quyen Admin)
) else (
    echo Da dung tat ca process dotnet
)

echo.
echo Kiem tra lai port 5000...
netstat -ano | findstr :5000
if errorlevel 1 (
    echo Port 5000 da trong!
) else (
    echo Port 5000 van con process dang su dung.
    echo Vui long chay script nay voi quyen Administrator hoac dung Task Manager de dung process.
)

pause
