@echo off
echo ========================================
echo Download ONNX Embedding Model
echo ========================================
echo.

REM Kiểm tra Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python không được tìm thấy!
    echo Vui lòng cài đặt Python từ https://www.python.org/
    pause
    exit /b 1
)

echo ✅ Python đã được cài đặt
echo.

REM Thử download trực tiếp từ Hugging Face trước
echo [Bước 1/2] Thử download ONNX model trực tiếp từ Hugging Face...
python download_onnx_simple.py

if errorlevel 1 (
    echo.
    echo ⚠️  Download trực tiếp không thành công
    echo.
    echo [Bước 2/2] Chuyển sang convert từ PyTorch model...
    python download_onnx_model.py
)

echo.
echo ========================================
echo Hoàn tất!
echo ========================================
echo.
echo Nếu thành công, file ONNX sẽ ở: C:\SQLServerModels\embedding_model.onnx
echo.
pause
