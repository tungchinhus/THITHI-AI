# Quick Start - Test RAG System

## ⚡ Test Nhanh trong 3 Bước

### Bước 1: Chuẩn bị

1. **Tạo file PDF test:**
   - Đặt file PDF vào `functions/test-document.pdf`
   - Hoặc sửa đường dẫn trong script

2. **Set API Key:**
   ```bash
   # Windows PowerShell
   $env:GEMINI_API_KEY="your_api_key_here"
   
   # Linux/Mac
   export GEMINI_API_KEY="your_api_key_here"
   ```

### Bước 2: Chạy Test

```bash
cd functions
node test-rag.js
```

### Bước 3: Xem Kết Quả

Script sẽ tự động:
- ✅ Ingest PDF vào SQL Server
- ✅ Kiểm tra database
- ✅ Test search với 3 queries
- ✅ Test chat với 3 questions

## 🎯 Test Qua HTTP (Sau khi Deploy)

### 1. Deploy Functions

```bash
firebase deploy --only functions:ragIngest,functions:ragChat
```

### 2. Set Function URL

```bash
export FUNCTION_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net"
```

### 3. Chạy Test

```bash
node test-rag-http.js
```

## 📝 Test Manual với cURL

### Ingest PDF

```bash
# Encode PDF
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

### Chat

```bash
curl -X POST \
  https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragChat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Máy bơm có công suất bao nhiêu?",
    "topK": 4
  }'
```

## ✅ Kết Quả Mong Đợi

### Ingest thành công:
```json
{
  "status": "success",
  "message": "Đã ingest thành công 45 chunks từ 1 trang",
  "data": {
    "totalChunks": 45,
    "totalPages": 1,
    "fileName": "test-document.pdf"
  }
}
```

### Chat thành công:
```json
{
  "answer": "Theo tài liệu, máy bơm có công suất 5HP...",
  "sources": [
    {
      "file_name": "test-document.pdf",
      "page_number": 1,
      "content_preview": "Máy bơm Model X...",
      "similarity": 0.89
    }
  ],
  "query": "Máy bơm có công suất bao nhiêu?"
}
```

## 🐛 Lỗi Thường Gặp

**"GEMINI_API_KEY not set"**
→ Set environment variable: `export GEMINI_API_KEY="your_key"`

**"PDF file not found"**
→ Đặt file PDF vào `functions/test-document.pdf`

**"SQL Server connection failed"**
→ Kiểm tra SQL Server đang chạy và set `SQL_SERVER_HOST`

Xem chi tiết trong [HUONG_DAN_TEST_RAG.md](HUONG_DAN_TEST_RAG.md)
