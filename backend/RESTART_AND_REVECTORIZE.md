# Hướng dẫn Re-vectorize Data

## Vấn đề
Data đã được import nhưng VectorJson và Embedding đều là NULL vì Python API chưa chạy khi import.

## Giải pháp

### Bước 1: Đảm bảo Python API đang chạy

```batch
cd d:\Project\thibidi\THITHI\python-api
start-service.bat
```

Kiểm tra:
```powershell
Invoke-WebRequest -Uri "http://localhost:5005/health" -UseBasicParsing
```

Kết quả mong đợi:
```json
{
  "status": "OK",
  "service": "Python Vectorize API",
  "model_loaded": true
}
```

### Bước 2: Restart Backend để load code mới

**Quan trọng:** Backend cần được restart để có endpoint `revectorize` mới.

1. **Dừng backend hiện tại:**
   - Tìm cửa sổ backend đang chạy
   - Nhấn `Ctrl+C` để dừng

2. **Build lại:**
```batch
cd d:\Project\thibidi\THITHI\THITHI-AI\backend\THIHI_AI.Backend
dotnet build
```

3. **Khởi động lại:**
```batch
dotnet run --launch-profile http
```

Hoặc dùng script:
```batch
cd d:\Project\thibidi\THITHI\THITHI-AI\backend
start-backend.bat
```

### Bước 3: Re-vectorize data

Sau khi backend đã restart, chạy script:

```batch
cd d:\Project\thibidi\THITHI\THITHI-AI\backend
revectorize-data.bat TSMay
```

Hoặc dùng PowerShell trực tiếp:

```powershell
cd d:\Project\thibidi\THITHI\THITHI-AI\backend
.\revectorize-data.ps1 -TableName "TSMay"
```

Hoặc dùng curl/Postman:

```powershell
$body = @{
    tableName = "TSMay"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/vectorimport/revectorize" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Kết quả mong đợi

Sau khi re-vectorize thành công:
- VectorJson sẽ được điền với JSON array của vector
- Embedding sẽ được điền với VECTOR type
- AI search sẽ hoạt động với dữ liệu này

## Kiểm tra kết quả

Chạy query SQL:
```sql
SELECT TOP 10 
    ID, 
    Content, 
    CASE WHEN VectorJson IS NULL THEN 'NULL' ELSE 'HAS VECTOR' END AS VectorStatus,
    CASE WHEN Embedding IS NULL THEN 'NULL' ELSE 'HAS EMBEDDING' END AS EmbeddingStatus
FROM TSMay
```

## Lưu ý

- Re-vectorize sẽ xử lý theo batch (50 records/lần) để tránh timeout
- Với bảng lớn (>1000 records), có thể mất vài phút
- Đảm bảo Python API vẫn chạy trong suốt quá trình re-vectorize

## Troubleshooting

### Lỗi 404 Not Found
- Backend chưa được restart sau khi thêm code mới
- Giải pháp: Restart backend (Bước 2)

### Lỗi Python API không kết nối được
- Python API chưa chạy hoặc đã dừng
- Giải pháp: Start Python API (Bước 1)

### Vector vẫn NULL sau khi re-vectorize
- Kiểm tra logs của backend để xem lỗi chi tiết
- Đảm bảo Content không rỗng
- Kiểm tra Python API có trả về vectors không
