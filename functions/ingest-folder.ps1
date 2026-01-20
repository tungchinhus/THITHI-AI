# ============================================
# Ingest Folder vào RAG System - PowerShell Script
# ============================================

# ⚠️ CHỈNH SỬA ĐÂY: Set folder path của bạn
$env:FOLDER_PATH = "C:\MyData\P-TK\TBKT-25140T-250kVA"

# ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment
if (-not $env:GEMINI_API_KEY) {
    $env:GEMINI_API_KEY = "AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE"
}

Write-Host ""
Write-Host "============================================"
Write-Host "  RAG Folder Ingest"
Write-Host "============================================"
Write-Host ""
Write-Host "📁 Folder: $env:FOLDER_PATH"
Write-Host ""

# Kiểm tra GEMINI_API_KEY - Ưu tiên environment variable, sau đó lấy từ Firebase
if (-not $env:GEMINI_API_KEY) {
    Write-Host "⚠️  GEMINI_API_KEY chưa được set trong environment"
    Write-Host ""
    Write-Host "🔑 Đang thử lấy từ Firebase Secrets..."
    Write-Host ""
    
    # Kiểm tra Firebase CLI
    $firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
    if ($firebaseCmd) {
        # Kiểm tra đã login chưa
        $projects = firebase projects:list 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Chưa login Firebase, đang thử login..."
            firebase login --no-localhost 2>$null
        }
        
        # Thử lấy từ Firebase
        $firebaseKey = firebase functions:secrets:access GEMINI_API_KEY 2>$null
        if ($firebaseKey -and $firebaseKey.Trim()) {
            $env:GEMINI_API_KEY = $firebaseKey.Trim()
            Write-Host "✅ Đã lấy GEMINI_API_KEY từ Firebase"
            Write-Host ""
        } else {
            Write-Host "❌ Không thể lấy GEMINI_API_KEY từ Firebase"
            Write-Host ""
            Write-Host "💡 Cách khắc phục:"
            Write-Host "   1. Set trong PowerShell: `$env:GEMINI_API_KEY='your_key'"
            Write-Host "   2. Chạy set-gemini-key.bat để set vào Firebase"
            Write-Host "   3. Hoặc chạy setup-firebase-secrets.bat"
            Write-Host ""
            Read-Host "Nhấn Enter để thoát"
            exit 1
        }
    } else {
        Write-Host "❌ Firebase CLI chưa được cài đặt"
        Write-Host ""
        Write-Host "💡 Cách khắc phục:"
        Write-Host "   1. Set trong PowerShell: `$env:GEMINI_API_KEY='your_key'"
        Write-Host "   2. Cài Firebase CLI: npm install -g firebase-tools"
        Write-Host ""
        Read-Host "Nhấn Enter để thoát"
        exit 1
    }
} else {
    Write-Host "✅ GEMINI_API_KEY đã được set trong environment"
    Write-Host ""
}

# Kiểm tra folder
if (-not (Test-Path $env:FOLDER_PATH)) {
    Write-Host "❌ Folder không tồn tại: $env:FOLDER_PATH"
    Write-Host ""
    Write-Host "💡 Chỉnh sửa FOLDER_PATH trong file này (dòng 7)"
    Read-Host "Nhấn Enter để thoát"
    exit 1
}

Write-Host "✅ Folder tồn tại"
if ($env:GEMINI_API_KEY) {
    $keyPreview = if ($env:GEMINI_API_KEY.Length -gt 20) { $env:GEMINI_API_KEY.Substring(0, 20) + "..." } else { $env:GEMINI_API_KEY }
    Write-Host "✅ GEMINI_API_KEY: Set (Length: $keyPreview)"
} else {
    Write-Host "❌ GEMINI_API_KEY: Not set"
}
Write-Host "✅ SQL Server: $env:SQL_SERVER_HOST\$env:SQL_SERVER_DATABASE"
Write-Host "✅ SQL User: $env:SQL_SERVER_USER"
Write-Host ""
Write-Host "🚀 Bắt đầu ingest..."
Write-Host ""

# Set SQL Server defaults
if (-not $env:SQL_SERVER_HOST) { $env:SQL_SERVER_HOST = "localhost" }
if (-not $env:SQL_SERVER_DATABASE) { $env:SQL_SERVER_DATABASE = "THITHI_AI" }
if (-not $env:SQL_SERVER_USER) { $env:SQL_SERVER_USER = "sa" }
if (-not $env:SQL_SERVER_PASSWORD) { $env:SQL_SERVER_PASSWORD = "123456" }

# Chạy ingest
node test-folder-ingest.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  ✅ HOÀN TẤT!"
    Write-Host "============================================"
    Write-Host ""
    Write-Host "💡 Bây giờ bạn có thể chat để tìm thông tin:"
    Write-Host "   - Chạy: test-rag-chat.bat"
    Write-Host "   - Hoặc gọi API: POST /ragChat"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  ❌ LỖI"
    Write-Host "============================================"
    Write-Host ""
    Write-Host "💡 Kiểm tra:"
    Write-Host "   1. GEMINI_API_KEY đúng chưa"
    Write-Host "   2. SQL Server đang chạy"
    Write-Host "   3. Folder có files (PDF, Word, Excel, TXT)"
    Write-Host ""
}

Read-Host "Nhấn Enter để thoát"
