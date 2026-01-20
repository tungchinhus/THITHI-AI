# =============================================
# PowerShell Script để Download ONNX Embedding Model
# =============================================
# Yêu cầu: Python với transformers và onnxruntime
# =============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Download ONNX Embedding Model" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Model mặc định
$modelName = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
$outputDir = "C:\SQLServerModels"
$outputFile = "$outputDir\embedding_model.onnx"

Write-Host "Model: $modelName" -ForegroundColor Yellow
Write-Host "Output: $outputFile" -ForegroundColor Yellow
Write-Host ""

# Kiểm tra Python
Write-Host "Kiểm tra Python..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python không được tìm thấy. Vui lòng cài đặt Python." -ForegroundColor Red
    exit 1
}

# Kiểm tra pip
Write-Host "Kiểm tra pip..." -ForegroundColor Cyan
try {
    $pipVersion = pip --version 2>&1
    Write-Host "✅ pip: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ pip không được tìm thấy." -ForegroundColor Red
    exit 1
}

# Cài đặt dependencies
Write-Host ""
Write-Host "Cài đặt dependencies..." -ForegroundColor Cyan
pip install transformers onnxruntime sentence-transformers --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Lỗi khi cài đặt dependencies." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Đã cài đặt dependencies" -ForegroundColor Green

# Tạo thư mục output
Write-Host ""
Write-Host "Tạo thư mục output..." -ForegroundColor Cyan
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Write-Host "✅ Đã tạo thư mục: $outputDir" -ForegroundColor Green
} else {
    Write-Host "✅ Thư mục đã tồn tại: $outputDir" -ForegroundColor Green
}

# Tạo Python script để convert model
Write-Host ""
Write-Host "Tạo Python script để convert model..." -ForegroundColor Cyan
$pythonScript = @"
from sentence_transformers import SentenceTransformer
import os

model_name = "$modelName"
output_file = r"$outputFile"

print(f"Loading model: {model_name}...")
model = SentenceTransformer(model_name)

print(f"Converting to ONNX...")
# Note: sentence-transformers không có sẵn ONNX export
# Cần convert thủ công hoặc download ONNX version từ Hugging Face
print("⚠️  sentence-transformers không hỗ trợ export ONNX trực tiếp.")
print("Vui lòng download ONNX model từ Hugging Face:")
print(f"https://huggingface.co/{model_name}")
print("")
print("Hoặc sử dụng script khác để convert PyTorch -> ONNX.")
"@

$scriptPath = "$env:TEMP\convert_to_onnx.py"
$pythonScript | Out-File -FilePath $scriptPath -Encoding UTF8

Write-Host "⚠️  Lưu ý: sentence-transformers không hỗ trợ export ONNX trực tiếp." -ForegroundColor Yellow
Write-Host ""
Write-Host "Có 2 cách để lấy ONNX model:" -ForegroundColor Cyan
Write-Host ""
Write-Host "CÁCH 1: Download từ Hugging Face (Khuyến nghị)" -ForegroundColor Green
Write-Host "1. Truy cập: https://huggingface.co/$modelName" -ForegroundColor White
Write-Host "2. Tìm file .onnx trong repository" -ForegroundColor White
Write-Host "3. Download và đặt vào: $outputFile" -ForegroundColor White
Write-Host ""
Write-Host "CÁCH 2: Convert từ PyTorch sang ONNX" -ForegroundColor Green
Write-Host "1. Load PyTorch model" -ForegroundColor White
Write-Host "2. Sử dụng torch.onnx.export() để convert" -ForegroundColor White
Write-Host "3. Lưu file .onnx vào: $outputFile" -ForegroundColor White
Write-Host ""

# Set permissions cho SQL Server
Write-Host "Thiết lập permissions cho SQL Server..." -ForegroundColor Cyan
try {
    # Thử set permissions cho SQL Server service account
    $sqlServiceAccount = "NT SERVICE\MSSQLSERVER"
    icacls $outputDir /grant "${sqlServiceAccount}:(OI)(CI)R" /T 2>&1 | Out-Null
    Write-Host "✅ Đã thiết lập permissions cho $sqlServiceAccount" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Không thể thiết lập permissions tự động. Vui lòng set thủ công:" -ForegroundColor Yellow
    Write-Host "   icacls `"$outputDir`" /grant `"NT SERVICE\MSSQLSERVER:(OI)(CI)R`" /T" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Hoàn tất!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bước tiếp theo:" -ForegroundColor Yellow
Write-Host "1. Download ONNX model từ Hugging Face" -ForegroundColor White
Write-Host "2. Đặt file .onnx vào: $outputFile" -ForegroundColor White
Write-Host "3. Chạy script CREATE_ONNX_MODEL.sql trong SQL Server" -ForegroundColor White
Write-Host ""
