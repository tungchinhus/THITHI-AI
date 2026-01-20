# Fix Lỗi CREATE EXTERNAL MODEL ONNX

## Lỗi gặp phải

1. **Msg 46505**: "Missing required external DDL option 'MODEL'."
2. **Msg 15151**: "Cannot find the external model 'local_onnx_embeddings'"

## Nguyên nhân

SQL Server 2025 yêu cầu option `MODEL` (tên model) khi tạo EXTERNAL MODEL với ONNX.

## Giải pháp

### Option 1: Thêm MODEL option (Đã fix trong script)

```sql
CREATE EXTERNAL MODEL [local_onnx_embeddings]
WITH (
    LOCATION = 'C:\SQLServerModels\embedding_model.onnx',
    API_FORMAT = 'ONNX Runtime',
    MODEL_TYPE = EMBEDDINGS,
    MODEL = 'embedding_model'  -- ⚠️ BẮT BUỘC
);
```

### Option 2: Nếu vẫn lỗi, thử với LOCAL_RUNTIME_PATH

Nếu SQL Server yêu cầu ONNX Runtime DLLs:

1. **Download ONNX Runtime:**
   - https://github.com/microsoft/onnxruntime/releases
   - Download version >= 1.19
   - Extract `onnxruntime.dll` vào `C:\onnx_runtime\`

2. **Download Tokenizers DLL:**
   - https://github.com/huggingface/tokenizers
   - Extract `tokenizers_cpp.dll` vào `C:\onnx_runtime\`

3. **Set permissions:**
   ```powershell
   icacls "C:\onnx_runtime" /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)R" /T
   ```

4. **Update CREATE EXTERNAL MODEL:**
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

### Option 3: Dùng thư mục thay vì file ONNX

Nếu SQL Server yêu cầu thư mục chứa model + tokenizer:

1. **Tạo thư mục:**
   ```
   C:\SQLServerModels\onnx_model\
   ├── model.onnx
   └── tokenizer.json (nếu có)
   ```

2. **Update CREATE EXTERNAL MODEL:**
   ```sql
   CREATE EXTERNAL MODEL [local_onnx_embeddings]
   WITH (
       LOCATION = 'C:\SQLServerModels\onnx_model',  -- Thư mục, không phải file
       API_FORMAT = 'ONNX Runtime',
       MODEL_TYPE = EMBEDDINGS,
       MODEL = 'embedding_model'
   );
   ```

## Kiểm tra

Sau khi tạo EXTERNAL MODEL thành công:

```sql
-- Kiểm tra model đã tạo
SELECT * FROM sys.external_models WHERE name = 'local_onnx_embeddings';

-- Test generate embeddings
SELECT AI_GENERATE_EMBEDDINGS('Test text' USE MODEL local_onnx_embeddings) AS Embedding;
```

## Troubleshooting

### Lỗi: "Cannot find the external model"
- Kiểm tra file ONNX có tồn tại: `Test-Path "C:\SQLServerModels\embedding_model.onnx"`
- Kiểm tra permissions: SQL Server service account có quyền đọc file
- Kiểm tra đường dẫn có đúng không (không có khoảng trắng, ký tự đặc biệt)

### Lỗi: "Missing required external DDL option"
- Đảm bảo có option `MODEL` trong CREATE EXTERNAL MODEL
- Kiểm tra syntax: `MODEL = 'model_name'` (có dấu = và quotes)

### Lỗi: "ONNX Runtime not found"
- Cần download ONNX Runtime DLLs
- Thêm `LOCAL_RUNTIME_PATH` vào CREATE EXTERNAL MODEL
- Set permissions cho thư mục chứa DLLs
