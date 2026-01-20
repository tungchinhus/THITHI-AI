# Hướng Dẫn Sử Dụng File .BAT

## 📋 Danh Sách File .BAT

### 0. `setup-firebase-secrets.bat` ⭐⭐⭐ (Chạy đầu tiên!)

**Mục đích:** Tự động lấy GEMINI_API_KEY từ Firebase và setup environment

**Cách dùng:**
1. Double-click `setup-firebase-secrets.bat`
2. Script sẽ tự động lấy GEMINI_API_KEY từ Firebase
3. Set các biến môi trường cần thiết

**Lưu ý:** Chạy script này TRƯỚC khi chạy các script khác!

### 1. `ingest-folder.bat` ⭐ (Khuyến nghị - Đơn giản nhất)

**Mục đích:** Ingest folder vào RAG system

**Cách dùng:**
1. **Setup từ Firebase (chạy đầu tiên):**
   ```batch
   setup-firebase-secrets.bat
   ```
   Script này sẽ tự động lấy GEMINI_API_KEY từ Firebase Functions.

2. **Chỉnh sửa folder path (nếu cần):**
   - Mở file `ingest-folder.bat`
   - Chỉnh sửa dòng 6: `set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA`

3. **Double-click để chạy**

**Ví dụ:**
```batch
REM Chỉnh sửa trong file:
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set GEMINI_API_KEY=your_key_here

REM Sau đó double-click file để chạy
```

### 2. `chat-rag.bat` ⭐ (Khuyến nghị - Đơn giản nhất)

**Mục đích:** Chat với RAG system để tìm thông tin

**Cách dùng:**
1. **Setup từ Firebase (nếu chưa chạy):**
   ```batch
   setup-firebase-secrets.bat
   ```

2. **Đảm bảo đã ingest folder:**
   ```batch
   ingest-folder.bat
   ```

3. **Chat:**
   - Double-click `chat-rag.bat`
   - Nhập câu hỏi

**Ví dụ:**
```batch
REM Set API key
set GEMINI_API_KEY=your_key_here

REM Chạy
chat-rag.bat

REM Nhập câu hỏi: "TBKT-25140T có công suất bao nhiêu?"
```

### 3. `test-folder-ingest.bat`

**Mục đích:** Test script đầy đủ với validation

**Cách dùng:**
```batch
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
set GEMINI_API_KEY=your_key_here
test-folder-ingest.bat
```

### 4. `test-rag-chat.bat`

**Mục đích:** Test chat với validation

**Cách dùng:**
```batch
set GEMINI_API_KEY=your_key_here
test-rag-chat.bat
```

### 5. `setup-firebase-secrets.bat` ⭐ (Khuyến nghị)

**Mục đích:** Tự động lấy GEMINI_API_KEY từ Firebase Secrets và setup environment

**Cách dùng:**
```batch
setup-firebase-secrets.bat
```

Script sẽ:
- ✅ Tự động lấy GEMINI_API_KEY từ Firebase
- ✅ Set FOLDER_PATH mặc định
- ✅ Set SQL Server config
- ✅ Hiển thị summary

### 6. `setup-env.bat`

**Mục đích:** Interactive setup environment variables (manual)

**Cách dùng:**
```batch
setup-env.bat
```

### 7. `get-firebase-secrets.bat`

**Mục đích:** Chỉ lấy GEMINI_API_KEY từ Firebase (không setup các biến khác)

**Cách dùng:**
```batch
get-firebase-secrets.bat
```

## ⚡ Quick Start (3 Bước)

### Bước 1: Setup Environment từ Firebase

```batch
# Chạy script để tự động lấy GEMINI_API_KEY từ Firebase
setup-firebase-secrets.bat
```

Hoặc lấy thủ công:
```batch
firebase functions:secrets:access GEMINI_API_KEY
set GEMINI_API_KEY=(kết quả)
```

### Bước 2: Chỉnh sửa Folder Path (nếu cần)

Mở `ingest-folder.bat` và chỉnh sửa:
```batch
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
```

### Bước 3: Chạy Ingest

Double-click `ingest-folder.bat`

### Bước 4: Chat

Double-click `chat-rag.bat` và nhập câu hỏi

## 📝 Ví Dụ Workflow

```batch
REM 1. Setup (lần đầu)
set GEMINI_API_KEY=your_key_here

REM 2. Ingest folder
ingest-folder.bat

REM 3. Chat
chat-rag.bat
```

## 🔧 Troubleshooting

### Lỗi: "GEMINI_API_KEY chưa được set"

**Giải pháp:**
```batch
REM Cách 1: Set trong file .bat
set GEMINI_API_KEY=your_key_here

REM Cách 2: Set environment variable
set GEMINI_API_KEY=your_key_here
ingest-folder.bat
```

### Lỗi: "Folder không tồn tại"

**Giải pháp:**
- Kiểm tra đường dẫn folder
- Chỉnh sửa FOLDER_PATH trong file .bat
- Đảm bảo dùng `\\` hoặc `/` trong path

### Lỗi: "SQL Server connection failed"

**Giải pháp:**
- Kiểm tra SQL Server đang chạy
- Set SQL_SERVER_HOST nếu cần
- Kiểm tra Windows Authentication

## 💡 Tips

1. **Lưu API key:**
   - Tạo file `set-api-key.bat` riêng:
   ```batch
   @echo off
   set GEMINI_API_KEY=your_key_here
   ```
   - Chạy trước khi chạy các script khác

2. **Chạy nhanh:**
   - Tạo shortcut trên desktop
   - Pin vào taskbar

3. **Xem logs:**
   - Logs hiển thị trong console
   - Kiểm tra từng file được xử lý

## 📚 Tài Liệu Tham Khảo

- [Hướng Dẫn Ingest Folder](HUONG_DAN_INGEST_FOLDER.md)
- [Hướng Dẫn Test RAG](HUONG_DAN_TEST_RAG.md)
- [RAG System Documentation](RAG_README.md)
