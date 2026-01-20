# Hướng Dẫn Ingest Folder vào RAG System

> **💡 Lưu ý:** GEMINI_API_KEY sẽ được lấy tự động từ Firebase Functions Secrets. Không cần set thủ công!

## 🎯 Mục Đích

Ingest toàn bộ files trong một folder (PDF, Word, Excel, TXT) vào RAG System để có thể tìm kiếm thông tin bằng ChatAI.

## 📋 Hỗ Trợ File Types

- ✅ **PDF** (.pdf)
- ✅ **Word** (.docx, .doc)
- ✅ **Excel** (.xlsx, .xls)
- ✅ **Text** (.txt, .md)

## 🚀 Cách 1: Test Local (Khuyến nghị)

### Bước 1: Setup Environment từ Firebase

**Lấy GEMINI_API_KEY từ Firebase Functions (Khuyến nghị):**

**Option 1: Dùng script tự động (Dễ nhất) ⭐**
```batch
# Chạy script để tự động lấy từ Firebase
setup-firebase-secrets.bat
```

**Option 2: Lấy thủ công**
```bash
# Windows PowerShell
$env:GEMINI_API_KEY=(firebase functions:secrets:access GEMINI_API_KEY)

# Windows CMD
for /f "tokens=*" %i in ('firebase functions:secrets:access GEMINI_API_KEY') do set GEMINI_API_KEY=%i
```

**Option 3: Lấy từ Firebase Console**
1. Vào Firebase Console > Functions > Secrets
2. Copy GEMINI_API_KEY value
3. Set: `set GEMINI_API_KEY=your_key_from_firebase`

**Set các biến khác (nếu cần):**

```bash
# Windows PowerShell
$env:SQL_SERVER_HOST="localhost"
$env:SQL_SERVER_DATABASE="THITHI_AI"
$env:FOLDER_PATH="C:\MyData\P-TK\TBKT-25140T-250kVA"

# Windows CMD
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA

# Linux/Mac
export SQL_SERVER_HOST="localhost"
export SQL_SERVER_DATABASE="THITHI_AI"
export FOLDER_PATH="/path/to/folder"
```

### Bước 2: Chạy Test Script

**Cách 1: Dùng .bat file (Khuyến nghị)**
```batch
# Sau khi chạy setup-firebase-secrets.bat
ingest-folder.bat
```

**Cách 2: Chạy trực tiếp Node.js**
```bash
cd functions
node test-folder-ingest.js
```

### Bước 3: Xem Kết Quả

Script sẽ:
- ✅ Scan folder và tìm tất cả files hỗ trợ
- ✅ Parse từng file (PDF, Word, Excel, TXT)
- ✅ Chia nhỏ thành chunks
- ✅ Generate embeddings
- ✅ Lưu vào SQL Server

**Ví dụ output:**
```
🧪 RAG Folder Ingest Test
==================================================
✅ GEMINI_API_KEY: Set
✅ Folder: C:\MyData\P-TK\TBKT-25140T-250kVA
✅ SQL Server: localhost:1433/THITHI_AI

🔌 Initializing SQL Server connection...
✅ SQL Server connected

📁 Starting folder ingest...
📁 Scanning folder: C:\MyData\P-TK\TBKT-25140T-250kVA
✅ Found 15 supported files

📄 Processing [1/15]: document1.pdf
   📦 Split into 45 chunks
   ✅ Inserted 45 chunks

📄 Processing [2/15]: spec.xlsx
   📦 Split into 12 chunks
   ✅ Inserted 12 chunks

...

✅ Ingest completed!
   Total files: 15
   Total chunks: 234

📋 File details:
   1. ✅ document1.pdf - 45 chunks
   2. ✅ spec.xlsx - 12 chunks
   3. ✅ manual.docx - 67 chunks
   ...

🎉 Test completed successfully!
💡 Bây giờ bạn có thể chat với RAG system để tìm thông tin trong folder này
```

## 🌐 Cách 2: Qua Firebase Functions (Production)

### Bước 1: Deploy Functions

```bash
firebase deploy --only functions:ragIngestFolder,functions:ragChat
```

### Bước 2: Gọi API

```bash
curl -X POST \
  https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragIngestFolder \
  -H "Content-Type: application/json" \
  -d '{
    "folderPath": "C:\\MyData\\P-TK\\TBKT-25140T-250kVA"
  }'
```

**Response:**
```json
{
  "status": "success",
  "message": "Đã ingest thành công 234 chunks từ 15 files",
  "data": {
    "totalFiles": 15,
    "totalChunks": 234,
    "files": [
      {
        "name": "document1.pdf",
        "chunks": 45,
        "status": "success"
      },
      {
        "name": "spec.xlsx",
        "chunks": 12,
        "status": "success"
      }
    ]
  }
}
```

## 💬 Sau Khi Ingest - Chat với RAG

Sau khi ingest folder, bạn có thể chat để tìm thông tin:

```bash
# Qua HTTP
curl -X POST \
  https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragChat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "TBKT-25140T có công suất bao nhiêu?",
    "topK": 4
  }'
```

**Response:**
```json
{
  "answer": "Theo tài liệu TBKT 25140T-250kVA, công suất là 250kVA...",
  "sources": [
    {
      "file_name": "spec.xlsx",
      "page_number": 1,
      "content_preview": "TBKT 25140T - 250kVA...",
      "similarity": 0.92
    }
  ],
  "query": "TBKT-25140T có công suất bao nhiêu?"
}
```

## 🔍 Tìm Kiếm trong Folder

### Ví dụ Queries:

1. **Tìm thông tin cụ thể:**
   - "TBKT-25140T có công suất bao nhiêu?"
   - "Thông số kỹ thuật của máy"
   - "Hướng dẫn lắp đặt"

2. **Tìm trong file cụ thể:**
   - "Trong file spec.xlsx có gì?"
   - "Nội dung file manual.docx"

3. **Tìm kiếm tổng quát:**
   - "Tóm tắt thông tin về sản phẩm"
   - "Có những tính năng gì?"

## 📊 Kiểm Tra Database

Sau khi ingest, kiểm tra data:

```sql
-- Xem tổng số chunks
SELECT COUNT(*) AS TotalChunks
FROM dbo.[rag_documents];

-- Xem files đã ingest
SELECT DISTINCT FileName, COUNT(*) AS ChunkCount
FROM dbo.[rag_documents]
GROUP BY FileName
ORDER BY ChunkCount DESC;

-- Xem sample data
SELECT TOP 5
    ID, FileName, PageNumber, ChunkIndex,
    LEFT(Content, 100) AS ContentPreview
FROM dbo.[rag_documents]
ORDER BY ID DESC;
```

## 🐛 Troubleshooting

### Lỗi: "Folder not found"

**Giải pháp:**
- Kiểm tra đường dẫn folder có đúng không
- Đảm bảo folder tồn tại
- Windows: Dùng `\\` hoặc `/` trong path

### Lỗi: "No supported files found"

**Giải pháp:**
- Kiểm tra folder có file PDF/Word/Excel/TXT không
- File extensions phải là: .pdf, .docx, .doc, .xlsx, .xls, .txt, .md

### Lỗi: "Failed to parse file"

**Nguyên nhân:**
- File bị corrupt
- File có password (chưa hỗ trợ)
- File format không đúng

**Giải pháp:**
- Kiểm tra file có thể mở được không
- Thử với file khác

### Lỗi: "SQL Server connection failed"

**Giải pháp:**
- Kiểm tra SQL Server đang chạy
- Set đúng SQL_SERVER_HOST, SQL_SERVER_DATABASE
- Kiểm tra firewall/network

## ⚙️ Cấu Hình

### Chunking Settings

Mặc định:
- `CHUNK_SIZE`: 1000 ký tự
- `CHUNK_OVERLAP`: 100 ký tự

Có thể chỉnh trong `rag-service.js`:
```javascript
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;
```

### Supported Extensions

Thêm file type mới trong `rag-service.js`:
```javascript
const supportedExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.md'];
```

## 📝 Lưu Ý

1. **Folder lớn:** Có thể mất nhiều thời gian để ingest
2. **Recursive:** Script sẽ quét cả subfolders
3. **Memory:** Folder rất lớn có thể tốn nhiều memory
4. **API Quota:** Mỗi chunk cần 1 API call để generate embedding

## ✅ Checklist

- [ ] Folder path đúng
- [ ] Folder có files hỗ trợ
- [ ] GEMINI_API_KEY đã set
- [ ] SQL Server đang chạy
- [ ] Ingest thành công
- [ ] Data trong database
- [ ] Chat hoạt động

## 🎓 Tips

1. **Test với folder nhỏ trước** (< 10 files)
2. **Kiểm tra logs** để xem file nào lỗi
3. **Ingest từng file** nếu folder quá lớn
4. **Backup database** trước khi ingest folder lớn

## 📚 Tài Liệu Tham Khảo

- [RAG System Documentation](RAG_README.md)
- [Test Guide](HUONG_DAN_TEST_RAG.md)
- [Chat Endpoint](RAG_README.md#chat-endpoint)
