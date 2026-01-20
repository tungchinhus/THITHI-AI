# Hướng Dẫn Sử Dụng SQL Server 2025 Native Embeddings

## Tổng Quan

Thay vì gọi Python API để tạo embeddings, hệ thống giờ sử dụng **SQL Server 2025 native `AI_GENERATE_EMBEDDINGS`** để tạo embeddings trực tiếp trong SQL Server.

## Lợi Ích

✅ **Không cần Python API server** - Giảm dependency và complexity  
✅ **Tốc độ nhanh hơn** - Không cần network call  
✅ **Tận dụng SQL Server 2025** - Sử dụng tính năng native mới nhất  
✅ **Dễ scale** - SQL Server tự quản lý resources  

## Cấu Hình

### 1. Cấu hình trong `appsettings.json`

```json
{
  "Embedding": {
    "Type": "SQL_SERVER",  // "SQL_SERVER" hoặc "PYTHON_API" (fallback)
    "ModelName": "azure_openai_embeddings"  // Tên EXTERNAL MODEL trong SQL Server
  }
}
```

### 2. Tạo EXTERNAL MODEL trong SQL Server 2025

Có 3 options để tạo EXTERNAL MODEL:

#### Option 1: Azure OpenAI Service (Khuyến nghị)

```sql
-- Cần có Azure OpenAI endpoint và API key
CREATE EXTERNAL MODEL [azure_openai_embeddings]
WITH (
    LOCATION = 'https://YOUR_OPENAI_ENDPOINT.openai.azure.com/',
    MODEL_TYPE = 'OPENAI',
    API_KEY = 'YOUR_API_KEY'
);
```

**Lưu ý:**
- Cần có Azure subscription và OpenAI resource
- Model `text-embedding-3-small` (1536 dimensions) hoặc `text-embedding-ada-002` (1536 dimensions)
- API key phải có quyền truy cập embedding endpoint

#### Option 2: ONNX Model (Local)

```sql
-- Cần download ONNX model và đặt vào thư mục SQL Server có thể truy cập
CREATE EXTERNAL MODEL [local_onnx_embeddings]
WITH (
    LOCATION = 'C:\Models\embedding_model.onnx',
    MODEL_TYPE = 'ONNX'
);
```

**Lưu ý:**
- Cần download ONNX embedding model (ví dụ: `paraphrase-multilingual-MiniLM-L12-v2.onnx`)
- Đặt model vào thư mục mà SQL Server service account có quyền đọc
- Model phải tương thích với SQL Server 2025 ONNX runtime

#### Option 3: REST Endpoint (Fallback - vẫn dùng Python API)

```sql
-- Nếu vẫn muốn dùng Python API nhưng gọi từ SQL Server
CREATE EXTERNAL MODEL [python_api_embeddings]
WITH (
    LOCATION = 'http://localhost:5005/vectorize',
    MODEL_TYPE = 'REST'
);
```

**Lưu ý:**
- Python API phải trả về format mà SQL Server 2025 mong đợi
- Format: `{"vectors": [[0.1, 0.2, ...], ...]}`

### 3. Kiểm tra EXTERNAL MODEL đã tạo

```sql
SELECT 
    name,
    location,
    model_type,
    created_date
FROM sys.external_models;
```

### 4. Test Generate Embeddings

```sql
-- Test với một text
SELECT 
    AI_GENERATE_EMBEDDINGS(
        'azure_openai_embeddings',
        'text-embedding-3-small',
        'Máy Bơm - Model X - Công suất 5HP'
    ) AS EmbeddingVector;
```

## Sử Dụng

### Import Excel với SQL Server Embeddings

1. **Cấu hình `appsettings.json`:**
   ```json
   {
     "Embedding": {
       "Type": "SQL_SERVER",
       "ModelName": "azure_openai_embeddings"
     }
   }
   ```

2. **Đảm bảo EXTERNAL MODEL đã được tạo** (xem bước 2 ở trên)

3. **Import Excel như bình thường** - Hệ thống sẽ tự động sử dụng SQL Server 2025 để generate embeddings

### Fallback về Python API

Nếu SQL Server embedding không hoạt động, có thể fallback về Python API:

```json
{
  "Embedding": {
    "Type": "PYTHON_API",
    "ModelName": ""
  }
}
```

## Troubleshooting

### Lỗi: "EXTERNAL MODEL không tồn tại"

**Giải pháp:**
- Kiểm tra tên model trong `appsettings.json` có khớp với tên trong SQL Server không
- Chạy query `SELECT * FROM sys.external_models;` để xem danh sách models
- Tạo EXTERNAL MODEL nếu chưa có (xem bước 2)

### Lỗi: "AI_GENERATE_EMBEDDINGS không được nhận diện"

**Giải pháp:**
- Đảm bảo đang dùng SQL Server 2025 (không phải 2022 hoặc cũ hơn)
- Kiểm tra version: `SELECT @@VERSION;`
- SQL Server 2025 phải có version >= 16.0

### Lỗi: "Không thể parse embedding"

**Giải pháp:**
- Kiểm tra format của embedding trả về từ EXTERNAL MODEL
- Có thể cần điều chỉnh `ParseVectorFromBytes` hoặc `ParseVectorFromString` trong code
- Xem logs để biết format thực tế

### Lỗi: "Azure OpenAI authentication failed"

**Giải pháp:**
- Kiểm tra API key có đúng không
- Kiểm tra endpoint URL có đúng không
- Kiểm tra Azure OpenAI resource có active không
- Kiểm tra network connectivity từ SQL Server đến Azure

## Dimension của Embeddings

- **text-embedding-3-small**: 1536 dimensions
- **text-embedding-ada-002**: 1536 dimensions
- **paraphrase-multilingual-MiniLM-L12-v2**: 384 dimensions

**Lưu ý:** Cần đảm bảo dimension trong code (`VECTOR(384)` hoặc `VECTOR(1536)`) khớp với model đang dùng.

## Tài Liệu Tham Khảo

- [SQL Server 2025 Vectors and Embeddings](https://devblogs.microsoft.com/azure-sql/sql-server-2025-embraces-vectors-setting-the-foundation-for-empowering-your-data-with-ai/)
- [AI_GENERATE_EMBEDDINGS Documentation](https://learn.microsoft.com/sql/t-sql/functions/ai-generate-embeddings-transact-sql)
- [CREATE EXTERNAL MODEL](https://learn.microsoft.com/sql/t-sql/statements/create-external-model-transact-sql)
