# Hướng Dẫn Test RAG System - Tìm Kiếm Thông Tin trong PDF

## 📋 Tổng Quan

Có 2 cách test RAG System:
1. **Test Local** - Test trực tiếp với Node.js (không cần deploy)
2. **Test HTTP** - Test qua Firebase Functions (sau khi deploy)

## 🧪 Cách 1: Test Local (Khuyến nghị cho development)

### Bước 1: Chuẩn bị

1. **Tạo file PDF test:**
   - Đặt file PDF vào thư mục `functions/`
   - Đổi tên thành `test-document.pdf` (hoặc sửa `TEST_PDF_PATH` trong script)

2. **Set environment variables:**
   ```bash
   # Windows PowerShell
   $env:GEMINI_API_KEY="your_api_key_here"
   $env:SQL_SERVER_HOST="localhost"
   $env:SQL_SERVER_DATABASE="THITHI_AI"
   # Optional (nếu dùng SQL Auth)
   $env:SQL_SERVER_USER="your_username"
   $env:SQL_SERVER_PASSWORD="your_password"

   # Linux/Mac
   export GEMINI_API_KEY="your_api_key_here"
   export SQL_SERVER_HOST="localhost"
   export SQL_SERVER_DATABASE="THITHI_AI"
   ```

### Bước 2: Chạy Test

```bash
cd functions
node test-rag.js
```

### Bước 3: Xem Kết Quả

Script sẽ chạy 4 tests:
1. ✅ **Ingest PDF** - Upload và xử lý PDF
2. ✅ **Database Check** - Kiểm tra data trong SQL Server
3. ✅ **Search** - Tìm kiếm semantic
4. ✅ **Chat** - Generate answer với RAG

**Ví dụ output:**
```
🧪 RAG System Test Suite
==================================================
✅ GEMINI_API_KEY: Set
✅ SQL Server: localhost:1433/THITHI_AI

🔌 Initializing SQL Server connection...
✅ SQL Server connected

📥 TEST 1: Ingest PDF
==================================================
📄 Reading PDF: test-document.pdf (123456 bytes)
⏳ Ingesting PDF...
✅ Ingest successful!
   - Total chunks: 45
   - Total pages: 1
   - File name: test-document.pdf

🗄️  TEST 4: Kiểm tra Database
==================================================
✅ Total chunks in database: 45
✅ VECTOR column: Yes (SQL Server 2025+)

🔍 TEST 2: Search Similar Chunks
==================================================
🔎 Query: "Máy bơm có công suất bao nhiêu?"
✅ Found 3 results:
   1. File: test-document.pdf, Page: 1
      Similarity: 89.23%
      Preview: Máy bơm Model X có công suất 5HP...

💬 TEST 3: Chat với RAG System
==================================================
❓ Question: "Máy bơm có công suất bao nhiêu?"
✅ Answer:
   Theo tài liệu, máy bơm có công suất 5HP...
```

## 🌐 Cách 2: Test qua HTTP (Firebase Functions)

### Bước 1: Deploy Functions

```bash
cd functions
firebase deploy --only functions:ragIngest,functions:ragChat
```

### Bước 2: Lấy Function URL

Sau khi deploy, Firebase sẽ trả về URLs:
```
✔  functions[ragIngest(us-central1)] Successful create operation.
✔  functions[ragChat(us-central1)] Successful create operation.

Function URL (ragIngest): https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragIngest
Function URL (ragChat): https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragChat
```

### Bước 3: Set Function URL

```bash
# Windows PowerShell
$env:FUNCTION_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net"

# Linux/Mac
export FUNCTION_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net"
```

### Bước 4: Chuẩn bị PDF Test

Đặt file PDF vào `functions/test-document.pdf`

### Bước 5: Chạy Test

```bash
cd functions
node test-rag-http.js
```

## 🔧 Test Manual với cURL

### 1. Ingest PDF

```bash
# Encode PDF to base64
# Windows PowerShell
$fileBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("test-document.pdf"))

# Linux/Mac
FILE_BASE64=$(base64 -i test-document.pdf)

# Send request
curl -X POST \
  https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragIngest \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$FILE_BASE64\",
    \"fileName\": \"test-document.pdf\"
  }"
```

### 2. Chat

```bash
curl -X POST \
  https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragChat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Máy bơm có công suất bao nhiêu?",
    "topK": 4
  }'
```

## 🧪 Test với Postman

### 1. Import Collection

Tạo collection mới trong Postman:

**Request 1: Ingest PDF**
- Method: `POST`
- URL: `https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragIngest`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "file": "{{pdf_base64}}",
  "fileName": "test-document.pdf"
}
```

**Request 2: Chat**
- Method: `POST`
- URL: `https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragChat`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "query": "Máy bơm có công suất bao nhiêu?",
  "topK": 4
}
```

### 2. Pre-request Script (cho Ingest)

Trong Pre-request Script của Ingest request:
```javascript
// Read PDF file and encode to base64
const fs = require('fs');
const pdfPath = './test-document.pdf';
const pdfBuffer = fs.readFileSync(pdfPath);
const pdfBase64 = pdfBuffer.toString('base64');
pm.environment.set('pdf_base64', pdfBase64);
```

## 🎯 Test Cases

### Test Case 1: Ingest PDF thành công

**Input:**
- File: PDF hợp lệ
- FileName: "test-document.pdf"

**Expected:**
- Status: 200
- Response có `totalChunks > 0`
- Data trong SQL Server

### Test Case 2: Ingest PDF lỗi

**Input:**
- File: null hoặc invalid
- FileName: missing

**Expected:**
- Status: 400
- Error message rõ ràng

### Test Case 3: Search với query hợp lệ

**Input:**
- Query: "Máy bơm có công suất bao nhiêu?"

**Expected:**
- Status: 200
- Answer không rỗng
- Sources có ít nhất 1 result
- Similarity > 0.3

### Test Case 4: Search với query không tìm thấy

**Input:**
- Query: "xyzabc123" (không có trong PDF)

**Expected:**
- Status: 200
- Answer: "Tôi không tìm thấy thông tin..."
- Sources: []

### Test Case 5: Chat với topK khác nhau

**Input:**
- Query: "Thông tin về sản phẩm"
- topK: 1, 2, 4, 10

**Expected:**
- Số lượng sources = topK (hoặc ít hơn nếu không đủ)
- Answer quality tốt hơn với topK lớn hơn

## 🐛 Troubleshooting

### Lỗi: "GEMINI_API_KEY not set"

**Giải pháp:**
```bash
export GEMINI_API_KEY="your_key"
# Hoặc
firebase functions:secrets:set GEMINI_API_KEY
```

### Lỗi: "SQL Server connection pool not initialized"

**Giải pháp:**
- Kiểm tra SQL Server đang chạy
- Set đúng SQL_SERVER_HOST, SQL_SERVER_DATABASE
- Kiểm tra firewall/network

### Lỗi: "PDF file not found"

**Giải pháp:**
- Đặt file PDF vào đúng thư mục
- Hoặc sửa `TEST_PDF_PATH` trong script

### Lỗi: "No results found"

**Nguyên nhân:**
- Chưa ingest PDF
- Query không match với nội dung PDF
- Embedding generation failed

**Giải pháp:**
- Chạy ingest trước
- Thử query khác
- Kiểm tra logs

### Lỗi: "VECTOR type not supported"

**Nguyên nhân:**
- SQL Server version < 2025

**Giải pháp:**
- System sẽ tự động fallback về VectorJson
- Hoặc upgrade SQL Server lên 2025

## 📊 Kiểm Tra Kết Quả

### 1. Kiểm tra Database

```sql
-- Xem tổng số chunks
SELECT COUNT(*) AS TotalChunks
FROM dbo.[rag_documents];

-- Xem sample data
SELECT TOP 5
    ID, FileName, PageNumber, ChunkIndex,
    LEN(Content) AS ContentLength,
    CASE WHEN Embedding IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasEmbedding
FROM dbo.[rag_documents]
ORDER BY ID DESC;

-- Test vector search
DECLARE @queryVector NVARCHAR(MAX) = '[0.1,0.2,0.3,...]'; -- Thay bằng vector thực tế
SELECT TOP 3
    Content,
    (1.0 - VECTOR_DISTANCE(Embedding, CAST(@queryVector AS VECTOR(384)), COSINE)) AS Similarity
FROM dbo.[rag_documents]
WHERE Embedding IS NOT NULL
ORDER BY VECTOR_DISTANCE(Embedding, CAST(@queryVector AS VECTOR(384)), COSINE) ASC;
```

### 2. Kiểm tra Logs

```bash
# Firebase Functions logs
firebase functions:log --only ragIngest,ragChat

# Local test logs
# Xem console output khi chạy node test-rag.js
```

## ✅ Checklist Test

- [ ] Ingest PDF thành công
- [ ] Data được lưu vào SQL Server
- [ ] VECTOR column được tạo (nếu SQL Server 2025+)
- [ ] Search trả về kết quả
- [ ] Similarity score hợp lý (> 0.3)
- [ ] Chat generate answer có ý nghĩa
- [ ] Sources có file name và page number
- [ ] Error handling hoạt động đúng

## 🎓 Tips

1. **Test với PDF nhỏ trước** (< 1MB) để nhanh
2. **Test với nhiều queries khác nhau** để đảm bảo search tốt
3. **Kiểm tra similarity scores** - nên > 0.5 cho kết quả tốt
4. **Test với PDF có nhiều trang** để kiểm tra page number
5. **Test với PDF có bảng/form** để kiểm tra text extraction

## 📚 Tài Liệu Tham Khảo

- [RAG System Documentation](RAG_README.md)
- [Firebase Functions Logs](https://firebase.google.com/docs/functions/manage-functions#view-logs)
- [SQL Server Vector Search](https://learn.microsoft.com/en-us/sql/relational-databases/search/semantic-search-sql-server)
