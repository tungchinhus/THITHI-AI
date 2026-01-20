# RAG System trong Firebase Functions

## 🎉 Đã Tích Hợp

RAG System đã được tích hợp trực tiếp vào Firebase Functions với 2 endpoints:
- `POST /ragIngest` - Ingest PDF files vào SQL Server với vector embeddings
- `POST /ragChat` - Chat với RAG system sử dụng semantic search

## 📋 Tính Năng

✅ **PDF Processing**: Parse PDF và chia nhỏ thành chunks  
✅ **Embedding Generation**: Sử dụng Gemini `text-embedding-004`  
✅ **Vector Storage**: Lưu vào SQL Server 2025 với VECTOR type  
✅ **Semantic Search**: Tìm kiếm bằng `VECTOR_DISTANCE`  
✅ **Answer Generation**: Generate answer với Gemini `1.5-flash`  
✅ **Sources**: Trả về file name và page number  

## 🔧 Cấu Hình

### 1. Firebase Secrets

Đảm bảo các secrets sau đã được set:

```bash
# Gemini API Key (đã có sẵn)
firebase functions:secrets:set GEMINI_API_KEY

# SQL Server (đã có sẵn)
firebase functions:secrets:set SQL_SERVER_HOST
firebase functions:secrets:set SQL_SERVER_DATABASE
# Optional (nếu dùng SQL Auth)
firebase functions:secrets:set SQL_SERVER_USER
firebase functions:secrets:set SQL_SERVER_PASSWORD
```

### 2. Deploy Functions

```bash
cd functions
npm install  # Đảm bảo pdf-parse đã được install
firebase deploy --only functions:ragIngest,functions:ragChat
```

## 🚀 Sử Dụng

### 1. Ingest PDF

**Endpoint:** `POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/ragIngest`

**Request:**
```json
{
  "file": "base64_encoded_pdf_content",
  "fileName": "document.pdf"
}
```

**Ví dụ với curl:**
```bash
# Encode PDF to base64
FILE_BASE64=$(base64 -i document.pdf)

curl -X POST \
  https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/ragIngest \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$FILE_BASE64\",
    \"fileName\": \"document.pdf\"
  }"
```

**Response:**
```json
{
  "status": "success",
  "message": "Đã ingest thành công 45 chunks từ 1 trang",
  "data": {
    "totalChunks": 45,
    "totalPages": 1,
    "fileName": "document.pdf"
  }
}
```

### 2. Chat với RAG System

**Endpoint:** `POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/ragChat`

**Request:**
```json
{
  "query": "Máy bơm có công suất bao nhiêu?",
  "topK": 4
}
```

**Ví dụ với curl:**
```bash
curl -X POST \
  https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/ragChat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Máy bơm có công suất bao nhiêu?",
    "topK": 4
  }'
```

**Response:**
```json
{
  "answer": "Theo tài liệu, máy bơm có công suất 5HP...",
  "sources": [
    {
      "file_name": "document.pdf",
      "page_number": 1,
      "content_preview": "Máy bơm Model X có công suất 5HP...",
      "similarity": 0.89
    }
  ],
  "query": "Máy bơm có công suất bao nhiêu?"
}
```

## 📊 Database Schema

Bảng `rag_documents` sẽ được tự động tạo với cấu trúc:

```sql
CREATE TABLE dbo.[rag_documents] (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Content NVARCHAR(MAX) NOT NULL,
    VectorJson NVARCHAR(MAX) NULL,
    Embedding VECTOR(384) NULL,  -- SQL Server 2025+
    FileName NVARCHAR(500) NULL,
    PageNumber INT NULL,
    ChunkIndex INT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE()
);
```

## 🔍 Workflow

1. **Ingest PDF:**
   - Parse PDF → Extract text
   - Split into chunks (1000 chars, 100 overlap)
   - Generate embeddings với Gemini
   - Store vào SQL Server với VECTOR type

2. **Chat:**
   - Generate embedding cho query
   - Search similar chunks bằng `VECTOR_DISTANCE`
   - Generate answer với Gemini dựa trên context
   - Return answer + sources

## 🛠️ Code Structure

```
functions/
├── rag-service.js      # RAG logic (PDF, embedding, search)
├── index.js            # Firebase Functions endpoints
├── sql-connection.js   # SQL Server connection (đã có)
└── package.json        # Dependencies
```

## 📝 Dependencies

Đã có sẵn trong `package.json`:
- `pdf-parse` - PDF parsing
- `@google/generative-ai` - Gemini API
- `mssql` - SQL Server connection
- `firebase-functions` - Firebase Functions

## 🐛 Troubleshooting

### Lỗi: "RAG service is not available"

**Giải pháp:**
- Kiểm tra `rag-service.js` đã được load
- Xem logs: `firebase functions:log`

### Lỗi: "SQL Server is not configured"

**Giải pháp:**
- Set `SQL_SERVER_HOST` secret
- Đảm bảo SQL Server connection đã được initialize

### Lỗi: "GEMINI_API_KEY is not configured"

**Giải pháp:**
- Set secret: `firebase functions:secrets:set GEMINI_API_KEY`
- Deploy lại: `firebase deploy --only functions`

### Lỗi khi parse PDF

**Nguyên nhân:**
- PDF bị corrupt
- PDF có password (chưa hỗ trợ)
- PDF là scan/hình ảnh (cần OCR)

**Giải pháp:**
- Kiểm tra PDF có thể mở được không
- Thử với PDF khác

## 🔄 Tích Hợp với Frontend

### Angular/TypeScript Example

```typescript
// rag.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RAGService {
  private baseUrl = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net';

  constructor(private http: HttpClient) {}

  ingestPDF(file: File): Observable<any> {
    return new Observable(observer => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        this.http.post(`${this.baseUrl}/ragIngest`, {
          file: base64,
          fileName: file.name
        }).subscribe({
          next: (result) => observer.next(result),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        });
      };
      reader.readAsDataURL(file);
    });
  }

  chat(query: string, topK: number = 4): Observable<any> {
    return this.http.post(`${this.baseUrl}/ragChat`, {
      query,
      topK
    });
  }
}
```

## 📚 API Reference

### POST /ragIngest

**Request Body:**
```typescript
{
  file: string;      // Base64 encoded PDF
  fileName: string;  // File name
}
```

**Response:**
```typescript
{
  status: "success" | "error";
  message: string;
  data?: {
    totalChunks: number;
    totalPages: number;
    fileName: string;
  };
}
```

### POST /ragChat

**Request Body:**
```typescript
{
  query: string;   // User query
  topK?: number;   // Number of results (default: 4)
}
```

**Response:**
```typescript
{
  answer: string;
  sources: Array<{
    file_name: string;
    page_number: number;
    content_preview: string;
    similarity: number;
  }>;
  query: string;
}
```

## ✅ Checklist

- [x] RAG service created
- [x] Ingest endpoint
- [x] Chat endpoint
- [x] SQL Server integration
- [x] Gemini API integration
- [x] Vector search với VECTOR_DISTANCE
- [x] Error handling
- [x] Documentation

## 🎯 Next Steps

- [ ] Support multiple PDF files batch upload
- [ ] Support PDF với password
- [ ] OCR cho PDF scan
- [ ] Update/Delete documents
- [ ] Metadata filtering
- [ ] Vector index optimization

## 📄 License

MIT
