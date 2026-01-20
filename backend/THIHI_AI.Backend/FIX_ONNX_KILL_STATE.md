# Fix Lỗi "Cannot continue the execution because the session is in the kill state"

## Nguyên nhân

Lỗi này thường xảy ra khi SQL Server không thể load ONNX model. Có thể do:

1. **File ONNX không tồn tại hoặc không thể truy cập**
2. **Thiếu ONNX Runtime DLLs** (nếu SQL Server yêu cầu)
3. **File ONNX bị corrupted hoặc không đúng format**
4. **SQL Server service account không có quyền đọc file**

## Giải pháp

### Giải pháp 1: Kiểm tra file ONNX

```powershell
# Kiểm tra file có tồn tại không
Test-Path "C:\SQLServerModels\embedding_model.onnx"

# Kiểm tra size và permissions
Get-Item "C:\SQLServerModels\embedding_model.onnx" | Select-Object FullName, Length, LastWriteTime

# Set permissions cho SQL Server
icacls "C:\SQLServerModels\embedding_model.onnx" /grant "NT SERVICE\MSSQLSERVER:(R)" /T
```

### Giải pháp 2: Thêm LOCAL_RUNTIME_PATH (nếu cần)

Nếu SQL Server yêu cầu ONNX Runtime DLLs:

1. **Download ONNX Runtime:**
   - https://github.com/microsoft/onnxruntime/releases
   - Download version >= 1.19 (Windows x64)
   - Extract `onnxruntime.dll` vào `C:\onnx_runtime\`

2. **Update CREATE EXTERNAL MODEL:**
   ```sql
   CREATE EXTERNAL MODEL [local_onnx_embeddings]
   WITH (
       LOCATION = 'C:\SQLServerModels\embedding_model.onnx',
       API_FORMAT = 'ONNX Runtime',
       MODEL_TYPE = EMBEDDINGS,
       MODEL = 'embedding_model',
       LOCAL_RUNTIME_PATH = 'C:\onnx_runtime\'  -- Thêm dòng này
   );
   ```

3. **Set permissions:**
   ```powershell
   icacls "C:\onnx_runtime" /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)R" /T
   ```

### Giải pháp 3: Kiểm tra SQL Server Error Log

1. Mở **SQL Server Management Studio**
2. Vào **Management > SQL Server Logs**
3. Xem log mới nhất để tìm lỗi chi tiết về ONNX

### Giải pháp 4: Test đơn giản (không dùng biến)

Thử query đơn giản này để xem lỗi chi tiết:

```sql
-- Test đơn giản
SELECT CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS('Test' USE MODEL local_onnx_embeddings)) AS Embedding;
```

Nếu vẫn lỗi, xem SQL Server Error Log để biết lỗi chi tiết.

### Giải pháp 5: Fallback về Python API (tạm thời)

Nếu ONNX không hoạt động, có thể fallback về Python API:

1. **Update appsettings.json:**
   ```json
   {
     "Embedding": {
       "Type": "PYTHON_API",
       "ModelName": ""
     }
   }
   ```

2. **Đảm bảo Python API đang chạy:**
   ```bash
   cd C:\MyData\projects\THITHI\THITHI_python-api
   run-server.bat
   ```

## Checklist

- [ ] File ONNX có tồn tại: `C:\SQLServerModels\embedding_model.onnx`
- [ ] File size > 0 (không rỗng)
- [ ] SQL Server service account có quyền đọc file
- [ ] Đã thử thêm `LOCAL_RUNTIME_PATH` (nếu cần)
- [ ] Đã kiểm tra SQL Server Error Log
- [ ] Đã test query đơn giản (không dùng biến)

## Next Steps

1. Chạy script `DEBUG_ONNX_ERROR.sql` để kiểm tra
2. Kiểm tra SQL Server Error Log để biết lỗi chi tiết
3. Thử các giải pháp trên theo thứ tự
4. Nếu vẫn không được, fallback về Python API tạm thời
