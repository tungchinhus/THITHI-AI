# Hướng Dẫn Setup ONNX Embedding Model cho SQL Server 2025

## Bước 1: Download ONNX Embedding Model

### Option A: Sử dụng Script Tự Động (Khuyến nghị) ⭐

**Cách nhanh nhất:** Chạy script tự động

```bash
# Chạy script batch (Windows)
cd C:\MyData\projects\THITHI\THIHI_AI\backend\THIHI_AI.Backend
DOWNLOAD_ONNX.bat
```

Script sẽ:
1. Tự động cài đặt dependencies (nếu cần)
2. Thử download ONNX model trực tiếp từ Hugging Face
3. Nếu không có ONNX sẵn, sẽ convert từ PyTorch model sang ONNX
4. Đặt file vào `C:\SQLServerModels\embedding_model.onnx`
5. Tự động set permissions cho SQL Server

**Hoặc chạy Python script trực tiếp:**
```bash
# Download trực tiếp từ Hugging Face (nhanh hơn)
python download_onnx_simple.py

# Hoặc convert từ PyTorch (nếu không có ONNX sẵn)
python download_onnx_model.py
```

### Option B: Download Thủ Công từ Hugging Face

1. **Truy cập Hugging Face:**
   - https://huggingface.co/models?search=onnx+embedding+multilingual
   - Hoặc: https://huggingface.co/models?search=sentence-transformers+onnx

2. **Model khuyến nghị:**
   - **paraphrase-multilingual-MiniLM-L12-v2** (384 dimensions)
     - Link: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
     - Hỗ trợ tiếng Việt tốt
     - Kích thước nhỏ (~420MB)
   
   - **multilingual-e5-base** (768 dimensions)
     - Link: https://huggingface.co/models?search=multilingual-e5-base+onnx
     - Hỗ trợ tiếng Việt tốt
     - Kích thước lớn hơn

3. **Download ONNX model:**
   ```bash
   # Sử dụng huggingface-cli (nếu đã cài)
   huggingface-cli download sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 --local-dir ./models/onnx
   
   # Hoặc download thủ công từ Hugging Face website
   # Tìm file .onnx trong repository và download
   ```

### Option B: Convert từ PyTorch Model sang ONNX

Nếu bạn đã có PyTorch model, có thể convert sang ONNX:

```python
from sentence_transformers import SentenceTransformer
import torch

# Load model
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

# Convert to ONNX
dummy_input = torch.zeros(1, 128, dtype=torch.long)  # Adjust based on your model
torch.onnx.export(
    model,
    dummy_input,
    "paraphrase-multilingual-MiniLM-L12-v2.onnx",
    input_names=['input_ids'],
    output_names=['embeddings'],
    dynamic_axes={'input_ids': {0: 'batch_size'}, 'embeddings': {0: 'batch_size'}}
)
```

## Bước 2: Đặt Model vào thư mục SQL Server có thể truy cập

### Tạo thư mục cho models:

```powershell
# Tạo thư mục (chạy với quyền Administrator)
New-Item -ItemType Directory -Path "C:\SQLServerModels" -Force

# Set permissions cho SQL Server service account
# Thường là: NT SERVICE\MSSQLSERVER hoặc NT SERVICE\MSSQL$INSTANCENAME
icacls "C:\SQLServerModels" /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)F" /T
```

### Copy ONNX model vào thư mục:

```powershell
# Copy file .onnx vào thư mục
Copy-Item "path\to\your\model.onnx" -Destination "C:\SQLServerModels\embedding_model.onnx"
```

### Lưu ý:
- SQL Server service account phải có quyền **đọc** file
- Đường dẫn không được có khoảng trắng hoặc ký tự đặc biệt
- Tên file nên đơn giản (không có khoảng trắng)

## Bước 3: Tạo EXTERNAL MODEL trong SQL Server

Mở SQL Server Management Studio và chạy script sau:

```sql
-- Tạo EXTERNAL MODEL với ONNX
CREATE EXTERNAL MODEL [local_onnx_embeddings]
WITH (
    LOCATION = 'C:\SQLServerModels\embedding_model.onnx',
    MODEL_TYPE = 'ONNX'
);

-- Kiểm tra model đã tạo
SELECT 
    name,
    location,
    model_type,
    created_date
FROM sys.external_models
WHERE name = 'local_onnx_embeddings';
```

## Bước 4: Test Generate Embeddings

```sql
-- Test với một text
SELECT 
    AI_GENERATE_EMBEDDINGS(
        'local_onnx_embeddings',
        NULL,  -- ONNX model không cần model name
        'Máy Bơm - Model X - Công suất 5HP'
    ) AS EmbeddingVector;

-- Test với nhiều texts
DECLARE @texts TABLE (Id INT IDENTITY(1,1), Text NVARCHAR(MAX));
INSERT INTO @texts (Text) VALUES
    ('Máy Bơm - Model X - Công suất 5HP'),
    ('Máy Nén - Model Y - Công suất 10HP'),
    ('Máy Phát Điện - Model Z - Công suất 20HP');

SELECT 
    t.Id,
    t.Text,
    AI_GENERATE_EMBEDDINGS('local_onnx_embeddings', NULL, t.Text) AS EmbeddingVector
FROM @texts t;
```

## Bước 5: Cập nhật appsettings.json

```json
{
  "Embedding": {
    "Type": "SQL_SERVER",
    "ModelName": "local_onnx_embeddings"
  }
}
```

## Bước 6: Cập nhật VECTOR dimension trong code

Nếu model của bạn có dimension khác 384, cần cập nhật:

1. **Trong SQL (khi tạo table):**
   ```sql
   -- Nếu model là 384 dimensions
   Embedding VECTOR(384) NULL
   
   -- Nếu model là 768 dimensions
   Embedding VECTOR(768) NULL
   
   -- Nếu model là 1536 dimensions
   Embedding VECTOR(1536) NULL
   ```

2. **Trong VectorImportService.cs:**
   - Tìm `VECTOR(384)` và thay bằng dimension của model bạn

## Troubleshooting

### Lỗi: "Cannot access ONNX model file"
- **Giải pháp:**
  - Kiểm tra đường dẫn file có đúng không
  - Kiểm tra SQL Server service account có quyền đọc file không
  - Thử đặt file vào thư mục khác (ví dụ: `C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Data\`)

### Lỗi: "ONNX model format không hợp lệ"
- **Giải pháp:**
  - Đảm bảo file .onnx là ONNX format hợp lệ
  - Thử download lại model từ nguồn khác
  - Kiểm tra version ONNX runtime của SQL Server 2025

### Lỗi: "Dimension mismatch"
- **Giải pháp:**
  - Kiểm tra dimension của model (384, 768, 1536, ...)
  - Cập nhật `VECTOR(dimension)` trong SQL và code cho đúng

### Lỗi: "AI_GENERATE_EMBEDDINGS không hoạt động với ONNX"
- **Giải pháp:**
  - Đảm bảo SQL Server 2025 đã enable ONNX runtime
  - Kiểm tra SQL Server version: `SELECT @@VERSION;` (phải >= 16.0)
  - Xem logs SQL Server để biết lỗi chi tiết

## Links hữu ích

- **Hugging Face ONNX Models:** https://huggingface.co/models?search=onnx+embedding
- **Sentence Transformers:** https://www.sbert.net/
- **ONNX Runtime:** https://onnxruntime.ai/

## Model Recommendations

| Model | Dimensions | Size | Tiếng Việt | Link |
|-------|-----------|------|------------|------|
| paraphrase-multilingual-MiniLM-L12-v2 | 384 | ~420MB | ✅ Tốt | [Link](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) |
| multilingual-e5-base | 768 | ~1.2GB | ✅ Rất tốt | [Link](https://huggingface.co/models?search=multilingual-e5-base) |
| multilingual-e5-large | 1024 | ~2.5GB | ✅ Rất tốt | [Link](https://huggingface.co/models?search=multilingual-e5-large) |

**Khuyến nghị:** Bắt đầu với `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions) vì nhỏ gọn và đủ tốt cho hầu hết use cases.
