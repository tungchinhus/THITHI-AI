# Hướng Dẫn Sử Dụng PDF Processing

## Tổng Quan

Đã tích hợp khả năng đọc và tìm kiếm thông tin trong file PDF vào hệ thống ChatAI. Hệ thống sẽ:
1. ✅ Trích xuất text từ PDF
2. ✅ Chia nhỏ text thành các chunks phù hợp
3. ✅ Tạo embeddings (vector hóa) cho từng chunk
4. ✅ Lưu vào SQL Server với vector search
5. ✅ Tìm kiếm semantic khi user hỏi

---

## Cài Đặt

### Bước 1: Cài đặt NuGet Packages

Các package đã được thêm vào `THIHI_AI.Backend.csproj`:
- `UglyToad.PdfPig` (v0.1.8) - Trích xuất text từ PDF
- `UglyToad.PdfPig.ContentExtraction` (v0.1.8) - Hỗ trợ extract content

**Lệnh cài đặt:**
```bash
cd backend/THIHI_AI.Backend
dotnet restore
```

---

## API Endpoints

### 1. Import PDF và Vectorize

**Endpoint:** `POST /api/pdfimport/import`

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Parameters:
  - `file` (IFormFile): File PDF cần import
  - `tableName` (string): Tên bảng SQL để lưu dữ liệu

**Response:**
```json
{
  "message": "Import PDF thành công",
  "fileName": "document.pdf",
  "tableName": "pdf_documents",
  "chunkCount": 45,
  "totalPages": 10
}
```

**Ví dụ sử dụng với curl:**
```bash
curl -X POST "http://localhost:5000/api/pdfimport/import" \
  -F "file=@document.pdf" \
  -F "tableName=pdf_documents"
```

**Ví dụ sử dụng với JavaScript (fetch):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('tableName', 'pdf_documents');

const response = await fetch('http://localhost:5000/api/pdfimport/import', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

---

### 2. Test Extract PDF (Không lưu vào database)

**Endpoint:** `POST /api/pdfimport/test-extract`

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Parameters:
  - `file` (IFormFile): File PDF cần test

**Response:**
```json
{
  "chunkCount": 45,
  "totalPages": 10,
  "chunks": [
    {
      "text": "Đoạn text đầu tiên từ PDF...",
      "pageNumber": 1,
      "chunkIndex": 0,
      "metadata": "Trang 1, Chunk 1 - document.pdf"
    },
    ...
  ]
}
```

**Mục đích:** Kiểm tra xem PDF có thể trích xuất text được không trước khi import.

---

### 3. Health Check

**Endpoint:** `GET /api/pdfimport/health`

**Response:**
```json
{
  "status": "OK",
  "service": "PdfImportService"
}
```

---

## Cấu Trúc Database

Sau khi import PDF, bảng sẽ có các cột sau:

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `ID` | INT | Primary key, auto increment |
| `Content` | NVARCHAR(MAX) | Nội dung text của chunk |
| `VectorJson` | NVARCHAR(MAX) | Embedding dạng JSON (backward compatibility) |
| `Embedding` | VECTOR(384) | Embedding native (SQL Server 2025+) |
| `PageNumber` | INT | Số trang trong PDF |
| `FileName` | NVARCHAR(500) | Tên file PDF gốc |
| `ChunkIndex` | INT | Chỉ số chunk trong trang |
| `DocumentType` | NVARCHAR(50) | Loại document (mặc định: 'PDF') |

**Ví dụ dữ liệu:**
```sql
SELECT TOP 5 
    ID, 
    Content, 
    PageNumber, 
    FileName, 
    ChunkIndex
FROM pdf_documents
ORDER BY ID;
```

---

## Tìm Kiếm trong PDF

Sau khi import PDF, có thể tìm kiếm bằng `VectorSearchService` hiện có:

### Sử dụng SearchController

Nếu đã có endpoint search, chỉ cần chỉ định `tableName` là tên bảng PDF:

```bash
POST /api/search/search
{
  "query": "thông tin về máy bơm",
  "tableName": "pdf_documents",
  "topK": 5
}
```

### Kết quả tìm kiếm sẽ bao gồm:
- `Content`: Đoạn text từ PDF
- `PageNumber`: Số trang
- `FileName`: Tên file
- `Similarity`: Điểm tương đồng (0-1)

---

## Workflow Hoàn Chỉnh

### 1. Upload và Import PDF

```javascript
// Frontend: Upload PDF
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('tableName', 'pdf_documents');

const response = await fetch('/api/pdfimport/import', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`Đã import ${result.chunkCount} chunks từ ${result.totalPages} trang`);
```

### 2. Tìm Kiếm trong PDF

```javascript
// Frontend: Tìm kiếm
const searchResponse = await fetch('/api/search/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'câu hỏi của user',
    tableName: 'pdf_documents',
    topK: 5
  })
});

const searchResults = await searchResponse.json();
// searchResults sẽ chứa các chunks phù hợp với câu hỏi
```

### 3. Hiển Thị Kết Quả

```javascript
searchResults.forEach(result => {
  console.log(`Trang ${result.pageNumber}: ${result.content}`);
  console.log(`File: ${result.fileName}`);
  console.log(`Độ tương đồng: ${result.similarity}`);
});
```

---

## Chiến Lược Chunking

PDF được chia nhỏ theo các quy tắc:

1. **Chia theo câu:** Text được chia tại các dấu câu (`.`, `!`, `?`, xuống dòng)
2. **Kích thước chunk:** Mỗi chunk ~500-1000 ký tự (mặc định: 800)
3. **Overlap:** Các chunks có overlap 10-20% để không mất context
4. **Metadata:** Mỗi chunk lưu PageNumber, FileName, ChunkIndex

**Ví dụ:**
- PDF 10 trang, mỗi trang ~2000 ký tự
- Sẽ tạo ra ~25-30 chunks (tùy nội dung)

---

## Xử Lý Lỗi

### PDF không có text (scan/hình ảnh)

Nếu PDF là scan (chỉ có hình ảnh), sẽ nhận được lỗi:
```json
{
  "error": "Không thể trích xuất text từ PDF. File có thể là scan (hình ảnh) hoặc bị lỗi."
}
```

**Giải pháp:**
- Sử dụng OCR (Tesseract) - cần Python service
- Hoặc dùng Azure Document Intelligence (cloud OCR)

### PDF có password

PdfPig hiện tại không hỗ trợ PDF có password. Cần:
- Unlock PDF trước khi upload
- Hoặc sử dụng thư viện khác (iText7 có hỗ trợ password)

---

## Best Practices

1. **Tên bảng:**
   - Sử dụng tên mô tả: `pdf_documents`, `pdf_manuals`, `pdf_reports`
   - Tránh ký tự đặc biệt, chỉ dùng chữ, số, dấu gạch dưới

2. **File size:**
   - PDF < 10MB: Xử lý trực tiếp
   - PDF > 10MB: Cân nhắc chia nhỏ hoặc xử lý theo batch

3. **Performance:**
   - Import PDF lớn có thể mất vài phút
   - Nên hiển thị progress bar cho user
   - Có thể xử lý async nếu cần

4. **Testing:**
   - Luôn test với `/api/pdfimport/test-extract` trước
   - Kiểm tra số lượng chunks và pages
   - Verify text extraction quality

---

## Ví Dụ Tích Hợp Frontend (Angular)

```typescript
// pdf-import.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PdfImportService {
  private apiUrl = 'http://localhost:5000/api/pdfimport';

  constructor(private http: HttpClient) {}

  importPdf(file: File, tableName: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tableName', tableName);

    return this.http.post(`${this.apiUrl}/import`, formData);
  }

  testExtract(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.apiUrl}/test-extract`, formData);
  }
}
```

```typescript
// pdf-import.component.ts
import { Component } from '@angular/core';
import { PdfImportService } from './pdf-import.service';

@Component({
  selector: 'app-pdf-import',
  template: `
    <input type="file" (change)="onFileSelected($event)" accept=".pdf">
    <button (click)="importPdf()" [disabled]="!selectedFile">Import PDF</button>
    <div *ngIf="result">
      <p>Đã import {{ result.chunkCount }} chunks từ {{ result.totalPages }} trang</p>
    </div>
  `
})
export class PdfImportComponent {
  selectedFile: File | null = null;
  result: any = null;

  constructor(private pdfService: PdfImportService) {}

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  importPdf() {
    if (!this.selectedFile) return;

    this.pdfService.importPdf(this.selectedFile, 'pdf_documents')
      .subscribe({
        next: (result) => {
          this.result = result;
          console.log('Import thành công:', result);
        },
        error: (error) => {
          console.error('Lỗi import:', error);
        }
      });
  }
}
```

---

## Troubleshooting

### Lỗi: "Không thể trích xuất text từ PDF"

**Nguyên nhân:**
- PDF là scan (chỉ có hình ảnh)
- PDF bị lỗi/corrupt
- PDF có password

**Giải pháp:**
1. Kiểm tra PDF có text không (mở bằng Adobe Reader)
2. Thử test với `/api/pdfimport/test-extract`
3. Nếu là scan, cần OCR

### Lỗi: "Embedding generation failed"

**Nguyên nhân:**
- SQL Server EXTERNAL MODEL chưa được setup
- Python API không chạy (nếu dùng PYTHON_API)

**Giải pháp:**
1. Kiểm tra `appsettings.json`:
   ```json
   {
     "Embedding": {
       "Type": "SQL_SERVER",  // hoặc "PYTHON_API"
       "ModelName": "local_onnx_embeddings"
     }
   }
   ```
2. Nếu dùng SQL_SERVER: Chạy script `CREATE_ONNX_MODEL.sql`
3. Nếu dùng PYTHON_API: Đảm bảo Python service đang chạy

### Lỗi: "Table already exists"

**Giải pháp:**
- Bảng đã tồn tại, hệ thống sẽ tự động thêm các cột cần thiết
- Nếu cần xóa và tạo lại: `DROP TABLE [table_name]`

---

## Next Steps

1. ✅ **Đã hoàn thành:**
   - PDF text extraction
   - Chunking strategy
   - Vector embedding
   - Database storage
   - API endpoints

2. 🔄 **Có thể mở rộng:**
   - OCR cho PDF scan (Tesseract + Python)
   - Extract tables từ PDF
   - Extract images từ PDF
   - Multi-file batch import
   - Progress tracking cho import lớn

3. 📝 **Tài liệu tham khảo:**
   - [PdfPig Documentation](https://github.com/UglyToad/PdfPig)
   - [SQL Server Vector Search](HUONG_DAN_VECTOR_SEARCH.md)
   - [ONNX Model Setup](SETUP_ONNX_MODEL.md)

---

## Tóm Tắt

✅ **Đã tích hợp thành công PDF processing vào hệ thống ChatAI**

**Các tính năng:**
- ✅ Trích xuất text từ PDF
- ✅ Chia nhỏ thành chunks
- ✅ Vector embedding
- ✅ Lưu vào SQL Server
- ✅ Tìm kiếm semantic

**Cách sử dụng:**
1. Upload PDF qua `/api/pdfimport/import`
2. Tìm kiếm qua `/api/search/search` với `tableName` là tên bảng PDF
3. Kết quả bao gồm PageNumber, FileName để hiển thị nguồn

**Lưu ý:**
- PDF scan (hình ảnh) cần OCR (chưa hỗ trợ)
- PDF có password cần unlock trước
- File lớn có thể mất vài phút để xử lý
