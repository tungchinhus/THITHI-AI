# Tóm Tắt Setup ONNX Model cho SQL Server 2025

## Files đã tạo

1. **SETUP_ONNX_MODEL.md** - Hướng dẫn chi tiết từng bước
2. **CREATE_ONNX_MODEL.sql** - Script SQL sẵn sàng để chạy
3. **DOWNLOAD_ONNX_MODEL.ps1** - Script PowerShell helper (cần download thủ công)
4. **appsettings.json** - Đã cập nhật để dùng `local_onnx_embeddings`

## Các bước thực hiện

### Bước 1: Download ONNX Model

**Khuyến nghị:** `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions)

1. Truy cập: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
2. Tìm file `.onnx` trong repository
3. Download file `.onnx`

**Hoặc các model khác:**
- `multilingual-e5-base` (768 dimensions)
- `multilingual-e5-large` (1024 dimensions)

### Bước 2: Đặt Model vào thư mục

```powershell
# Tạo thư mục (chạy với quyền Administrator)
New-Item -ItemType Directory -Path "C:\SQLServerModels" -Force

# Set permissions cho SQL Server
icacls "C:\SQLServerModels" /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)R" /T

# Copy file .onnx vào thư mục
Copy-Item "path\to\model.onnx" -Destination "C:\SQLServerModels\embedding_model.onnx"
```

### Bước 3: Chạy SQL Script

1. Mở **SQL Server Management Studio**
2. Mở file **CREATE_ONNX_MODEL.sql**
3. **Thay đường dẫn** trong script (dòng có `LOCATION = 'C:\SQLServerModels\embedding_model.onnx'`)
4. Chạy script

### Bước 4: Test

```sql
-- Test generate embedding
SELECT AI_GENERATE_EMBEDDINGS(
    'local_onnx_embeddings',
    NULL,
    'Máy Bơm - Model X - Công suất 5HP'
) AS EmbeddingVector;
```

### Bước 5: Cập nhật appsettings.json (Đã làm)

```json
{
  "Embedding": {
    "Type": "SQL_SERVER",
    "ModelName": "local_onnx_embeddings"
  }
}
```

### Bước 6: Kiểm tra VECTOR dimension

Code hiện tại đang dùng **VECTOR(384)**. Nếu model của bạn có dimension khác, cần cập nhật:

1. **VectorImportService.cs:**
   - Tìm `VECTOR(384)` và thay bằng dimension của model bạn

2. **VectorSearchService.cs:**
   - Tìm `VECTOR(384)` và thay bằng dimension của model bạn

3. **Table creation script:**
   - Tìm `VECTOR(384)` và thay bằng dimension của model bạn

**Cách xác định dimension:**
- Model `paraphrase-multilingual-MiniLM-L12-v2`: **384 dimensions**
- Model `multilingual-e5-base`: **768 dimensions**
- Model `multilingual-e5-large`: **1024 dimensions**

## Troubleshooting

### Lỗi: "Cannot access ONNX model file"
- Kiểm tra đường dẫn file có đúng không
- Kiểm tra SQL Server service account có quyền đọc file
- Thử đặt file vào thư mục khác

### Lỗi: "Dimension mismatch"
- Kiểm tra dimension của model (384, 768, 1024, ...)
- Cập nhật `VECTOR(dimension)` trong code cho đúng

### Lỗi: "AI_GENERATE_EMBEDDINGS không hoạt động"
- Đảm bảo SQL Server 2025 (version >= 16.0)
- Kiểm tra ONNX runtime đã được enable
- Xem logs SQL Server để biết lỗi chi tiết

## Next Steps

1. ✅ Download ONNX model
2. ✅ Đặt vào `C:\SQLServerModels\embedding_model.onnx`
3. ✅ Chạy `CREATE_ONNX_MODEL.sql`
4. ✅ Test generate embeddings
5. ✅ Import Excel và kiểm tra logs

## Links hữu ích

- **Hugging Face Models:** https://huggingface.co/models?search=onnx+embedding
- **Sentence Transformers:** https://www.sbert.net/
- **ONNX Runtime:** https://onnxruntime.ai/
