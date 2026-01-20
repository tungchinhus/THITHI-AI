# Hướng dẫn Re-vectorize Data Nhanh

## Cách 1: Dùng script tự động (Khuyến nghị)

Script này sẽ tự động:
1. Kiểm tra và start Python API nếu chưa chạy
2. Kiểm tra và start Backend nếu chưa chạy  
3. Re-vectorize data

```batch
cd d:\Project\thibidi\THITHI\THITHI-AI\backend
start-all-and-revectorize.bat TSMay
```

Hoặc không chỉ định tên bảng (mặc định: TSMay):
```batch
start-all-and-revectorize.bat
```

## Cách 2: Chạy từng bước thủ công

### Bước 1: Start Python API

```batch
cd d:\Project\thibidi\THITHI\python-api
start-service.bat
```

Đợi đến khi thấy "Model đã load thành công!" (có thể mất vài phút lần đầu).

### Bước 2: Đảm bảo Backend đang chạy

Nếu chưa chạy:
```batch
cd d:\Project\thibidi\THITHI\THITHI-AI\backend
start-backend.bat
```

### Bước 3: Re-vectorize

**Trong PowerShell:**
```powershell
cd d:\Project\thibidi\THITHI\THITHI-AI\backend
.\revectorize-data.ps1 -TableName "TSMay"
```

**Trong CMD:**
```batch
cd d:\Project\thibidi\THITHI\THITHI-AI\backend
revectorize-data.bat TSMay
```

## Cách 3: Dùng API trực tiếp

Nếu cả hai services đã chạy:

```powershell
$body = @{
    tableName = "TSMay"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/vectorimport/revectorize" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Kiểm tra kết quả

Sau khi re-vectorize, kiểm tra trong SQL Server:

```sql
SELECT TOP 10 
    ID, 
    Content,
    CASE WHEN VectorJson IS NULL THEN 'NULL' ELSE 'HAS VECTOR' END AS VectorStatus,
    CASE WHEN Embedding IS NULL THEN 'NULL' ELSE 'HAS EMBEDDING' END AS EmbeddingStatus
FROM TSMay
ORDER BY ID
```

## Troubleshooting

### Lỗi "The term 'revectorize-data.bat' is not recognized"
**Giải pháp:** Trong PowerShell, dùng `.\revectorize-data.bat` thay vì `revectorize-data.bat`

### Python API timeout
- Model đang được load (lần đầu có thể mất vài phút)
- Đợi thêm vài phút rồi thử lại
- Kiểm tra: `http://localhost:5005/health`

### Backend 404 Not Found
- Backend chưa được restart sau khi thêm code mới
- Restart backend: `restart-backend.bat`

### Vector vẫn NULL sau khi re-vectorize
- Kiểm tra logs của backend
- Đảm bảo Content không rỗng
- Kiểm tra Python API có trả về vectors không
