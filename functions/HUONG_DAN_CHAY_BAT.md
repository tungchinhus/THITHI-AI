# Hướng Dẫn Chạy File .BAT

## 📋 Các File .BAT Có Sẵn

1. **`setup-env.bat`** - Setup environment variables
2. **`test-folder-ingest.bat`** - Ingest folder vào RAG system
3. **`test-rag-chat.bat`** - Test chat với RAG system

## 🚀 Cách Sử Dụng

### Bước 1: Setup Environment (Lần đầu tiên)

Chạy `setup-env.bat` để set các biến môi trường:

```batch
setup-env.bat
```

Script sẽ hỏi:
- GEMINI_API_KEY
- FOLDER_PATH (ví dụ: `C:\MyData\P-TK\TBKT-25140T-250kVA`)
- SQL_SERVER_HOST (mặc định: localhost)
- SQL_SERVER_DATABASE (mặc định: THITHI_AI)
- SQL Server Authentication (nếu cần)

### Bước 2: Ingest Folder

Chạy `test-folder-ingest.bat`:

```batch
test-folder-ingest.bat
```

Hoặc set FOLDER_PATH trước:

```batch
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
test-folder-ingest.bat
```

### Bước 3: Test Chat

Sau khi ingest, chạy `test-rag-chat.bat`:

```batch
test-rag-chat.bat
```

Nhập câu hỏi hoặc Enter để dùng câu hỏi mặc định.

## ⚡ Quick Start

### Option 1: Chỉnh sửa file .bat

Mở `test-folder-ingest.bat` và chỉnh sửa:

```batch
REM Set default folder path (chỉnh sửa đây)
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
```

Sau đó chạy:
```batch
test-folder-ingest.bat
```

### Option 2: Set trong CMD/PowerShell

```batch
REM Set environment variables
set GEMINI_API_KEY=your_api_key_here
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI

REM Chạy test
test-folder-ingest.bat
```

## 📝 Ví Dụ Workflow Hoàn Chỉnh

```batch
REM 1. Setup (lần đầu)
setup-env.bat

REM 2. Ingest folder
test-folder-ingest.bat

REM 3. Test chat
test-rag-chat.bat
```

## 🔧 Troubleshooting

### Lỗi: "GEMINI_API_KEY chưa được set"

**Giải pháp:**
```batch
set GEMINI_API_KEY=your_api_key_here
test-folder-ingest.bat
```

### Lỗi: "Folder không tồn tại"

**Giải pháp:**
- Kiểm tra đường dẫn folder
- Chỉnh sửa FOLDER_PATH trong file .bat
- Hoặc set FOLDER_PATH trước khi chạy

### Lỗi: "SQL Server connection failed"

**Giải pháp:**
- Kiểm tra SQL Server đang chạy
- Set đúng SQL_SERVER_HOST
- Kiểm tra Windows Authentication hoặc SQL Auth

## 💡 Tips

1. **Lưu environment variables:**
   - Set trong System Properties > Environment Variables
   - Hoặc tạo file `set-env.bat` riêng

2. **Chạy nhanh:**
   - Double-click file .bat
   - Hoặc chạy từ CMD: `cd functions && test-folder-ingest.bat`

3. **Xem logs:**
   - Logs sẽ hiển thị trong console
   - Kiểm tra từng file được xử lý

## 📚 Tài Liệu Tham Khảo

- [Hướng Dẫn Ingest Folder](HUONG_DAN_INGEST_FOLDER.md)
- [Hướng Dẫn Test RAG](HUONG_DAN_TEST_RAG.md)
- [RAG System Documentation](RAG_README.md)
