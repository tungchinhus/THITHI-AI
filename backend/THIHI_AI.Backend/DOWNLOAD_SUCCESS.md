# ✅ Download ONNX Model Thành Công!

## File đã được download

- **File:** `C:\SQLServerModels\embedding_model.onnx`
- **Size:** 448.51 MB
- **Model:** paraphrase-multilingual-MiniLM-L12-v2
- **Dimensions:** 384

## Bước tiếp theo

### 1. Kiểm tra file đã tồn tại

```powershell
Test-Path "C:\SQLServerModels\embedding_model.onnx"
# Phải trả về: True
```

### 2. Chạy SQL Script để tạo EXTERNAL MODEL

1. Mở **SQL Server Management Studio**
2. Mở file **CREATE_ONNX_MODEL.sql**
3. **Kiểm tra đường dẫn** trong script (phải là `C:\SQLServerModels\embedding_model.onnx`)
4. Chạy script

### 3. Test Generate Embeddings

```sql
-- Test với một text
SELECT AI_GENERATE_EMBEDDINGS(
    'local_onnx_embeddings',
    NULL,
    'Máy Bơm - Model X - Công suất 5HP'
) AS EmbeddingVector;
```

Nếu test thành công, bạn sẽ thấy một VECTOR binary được trả về.

### 4. Import Excel

Sau khi test thành công, import Excel như bình thường. Hệ thống sẽ tự động sử dụng SQL Server 2025 để generate embeddings.

## Permissions

Permissions đã được thiết lập cho SQL Server service account (`NT SERVICE\MSSQLSERVER`).

Nếu gặp lỗi "Cannot access file", chạy lại:

```powershell
icacls "C:\SQLServerModels" /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)R" /T
```

## Troubleshooting

### Lỗi: "EXTERNAL MODEL không tồn tại"
- Kiểm tra đã chạy `CREATE_ONNX_MODEL.sql` chưa
- Kiểm tra tên model trong script có đúng không (`local_onnx_embeddings`)

### Lỗi: "Cannot access ONNX model file"
- Kiểm tra file có tồn tại không: `Test-Path "C:\SQLServerModels\embedding_model.onnx"`
- Kiểm tra permissions: `icacls "C:\SQLServerModels"`
- Đảm bảo SQL Server service account có quyền đọc

### Lỗi: "AI_GENERATE_EMBEDDINGS không hoạt động"
- Đảm bảo SQL Server 2025 (version >= 16.0)
- Kiểm tra: `SELECT @@VERSION;`
- Xem logs SQL Server để biết lỗi chi tiết

## Files liên quan

- ✅ `C:\SQLServerModels\embedding_model.onnx` - ONNX model file
- 📄 `CREATE_ONNX_MODEL.sql` - Script tạo EXTERNAL MODEL
- 📄 `SETUP_ONNX_MODEL.md` - Hướng dẫn chi tiết
- 📄 `appsettings.json` - Đã cấu hình `local_onnx_embeddings`

## Next Steps

1. ✅ Download ONNX model - **HOÀN TẤT**
2. ⏳ Chạy `CREATE_ONNX_MODEL.sql` trong SQL Server
3. ⏳ Test generate embeddings
4. ⏳ Import Excel và kiểm tra logs
