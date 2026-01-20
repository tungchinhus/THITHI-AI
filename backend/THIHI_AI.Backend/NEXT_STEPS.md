# Các Bước Tiếp Theo - Setup ONNX Embeddings

## ✅ Đã hoàn thành

1. ✅ Download ONNX model: `C:\SQLServerModels\embedding_model.onnx`
2. ✅ Enable ONNX Provider: Đã chạy `ENABLE_ONNX_PROVIDER.sql`

## 📋 Các bước tiếp theo

### Bước 1: Tạo EXTERNAL MODEL

1. Mở SQL Server Management Studio
2. Mở file **`CREATE_ONNX_MODEL.sql`**
3. **Kiểm tra đường dẫn** trong script (dòng 38):
   ```sql
   LOCATION = 'C:\SQLServerModels\embedding_model.onnx'
   ```
4. Chạy toàn bộ script

**Kết quả mong đợi:**
- ✅ EXTERNAL MODEL `local_onnx_embeddings` được tạo thành công
- ✅ Test `AI_GENERATE_EMBEDDINGS` trả về JSON string (không lỗi)

### Bước 2: Test Generate Embeddings

Sau khi tạo EXTERNAL MODEL thành công, test thủ công:

```sql
-- Test đơn giản
SELECT AI_GENERATE_EMBEDDINGS('Máy Bơm - Model X' USE MODEL local_onnx_embeddings) AS EmbeddingJson;
```

**Kết quả mong đợi:**
- Trả về JSON string: `[0.123, -0.456, 0.789, ...]` (384 values cho model paraphrase-multilingual-MiniLM-L12-v2)

### Bước 3: Cập nhật C# Code

Sau khi test thành công, cần cập nhật C# code để parse JSON thay vì binary:

**File:** `VectorImportService.cs`

**Thay đổi cần thiết:**
1. `GetVectorsFromSqlServerAsync()` - Parse JSON string từ `AI_GENERATE_EMBEDDINGS`
2. Sử dụng `System.Text.Json` để parse JSON array thành `List<float>`

### Bước 4: Test Import Excel

1. Restart backend (nếu đang chạy)
2. Import Excel file như bình thường
3. Kiểm tra logs để xem embeddings có được tạo không
4. Kiểm tra database: `SELECT TOP 3 ID, Content, VectorJson, Embedding FROM [TSMay]`

## 🔍 Troubleshooting

### Nếu CREATE EXTERNAL MODEL lỗi:

**Lỗi: "Cannot find the external model"**
- Kiểm tra file ONNX có tồn tại: `Test-Path "C:\SQLServerModels\embedding_model.onnx"`
- Kiểm tra permissions: SQL Server service account có quyền đọc file

**Lỗi: "Missing required external DDL option"**
- Đảm bảo có option `MODEL` trong CREATE EXTERNAL MODEL
- Kiểm tra syntax: `MODEL = 'embedding_model'`

**Lỗi: "ONNX provider is not enabled"**
- Chạy lại `ENABLE_ONNX_PROVIDER.sql`
- Kiểm tra: `SELECT * FROM sys.configurations WHERE name = 'external AI runtimes enabled'`

### Nếu AI_GENERATE_EMBEDDINGS lỗi:

**Lỗi: "Operand type clash: json is incompatible with varbinary"**
- ✅ Đã fix: Code đã được cập nhật để xử lý JSON string
- Đảm bảo dùng `NVARCHAR(MAX)` thay vì `VARBINARY(MAX)` cho biến nhận kết quả

**Lỗi: "Cannot find the external model"**
- Kiểm tra EXTERNAL MODEL đã được tạo: `SELECT * FROM sys.external_models`
- Đảm bảo tên model đúng: `local_onnx_embeddings`

## 📝 Checklist

- [ ] Chạy `CREATE_ONNX_MODEL.sql` thành công
- [ ] Test `AI_GENERATE_EMBEDDINGS` trả về JSON string
- [ ] Cập nhật C# code để parse JSON
- [ ] Test import Excel với SQL Server embeddings
- [ ] Kiểm tra database có embeddings không

## 🎯 Mục tiêu cuối cùng

- ✅ Không cần Python API server
- ✅ Embeddings được tạo trực tiếp trong SQL Server 2025
- ✅ Import Excel hoạt động với SQL Server native embeddings
- ✅ Vector search hoạt động với embeddings từ SQL Server
