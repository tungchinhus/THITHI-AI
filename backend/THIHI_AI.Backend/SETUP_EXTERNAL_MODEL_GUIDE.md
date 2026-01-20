# Hướng Dẫn Setup EXTERNAL MODEL cho SQL Server 2025

## Bước 1: Chọn Option

Bạn có 3 lựa chọn:

### Option 1: Azure OpenAI Service ⭐ (Khuyến nghị)
- **Ưu điểm:** Dễ setup, không cần download model, hỗ trợ tốt tiếng Việt
- **Yêu cầu:** Azure subscription với OpenAI resource
- **Chi phí:** Trả theo usage (rất rẻ cho embedding)

### Option 2: ONNX Model (Local)
- **Ưu điểm:** Không cần internet, không tốn chi phí
- **Yêu cầu:** Download ONNX model, đặt vào thư mục SQL Server có thể truy cập
- **Chi phí:** Miễn phí

### Option 3: REST Endpoint (Python API)
- **Ưu điểm:** Vẫn dùng Python API hiện tại
- **Yêu cầu:** Python API server đang chạy
- **Chi phí:** Miễn phí (nhưng vẫn cần Python server)

---

## Bước 2: Setup theo Option đã chọn

### Nếu chọn Option 1: Azure OpenAI

1. **Tạo Azure OpenAI Resource:**
   - Vào [Azure Portal](https://portal.azure.com)
   - Tìm "OpenAI" > Create
   - Chọn subscription, resource group, region
   - Chọn pricing tier (S0 - Pay-as-you-go)
   - Deploy model: `text-embedding-3-small` hoặc `text-embedding-ada-002`

2. **Lấy Endpoint và API Key:**
   - Vào Azure Portal > OpenAI resource
   - Vào "Keys and Endpoint"
   - Copy "Endpoint" (ví dụ: `https://your-resource.openai.azure.com/`)
   - Copy "Key 1" hoặc "Key 2"

3. **Chạy SQL Script:**
   - Mở file `CREATE_EXTERNAL_MODEL.sql`
   - Uncomment phần OPTION 1
   - Thay `YOUR_ENDPOINT` và `YOUR_API_KEY` bằng giá trị thực tế
   - Chạy script trong SQL Server Management Studio

4. **Test:**
   ```sql
   SELECT AI_GENERATE_EMBEDDINGS(
       'azure_openai_embeddings',
       'text-embedding-3-small',
       'Test text'
   ) AS EmbeddingVector;
   ```

### Nếu chọn Option 2: ONNX Model

1. **Download ONNX Model:**
   - Từ Hugging Face: https://huggingface.co/models?search=onnx+embedding
   - Hoặc convert từ PyTorch model sang ONNX
   - Ví dụ: `paraphrase-multilingual-MiniLM-L12-v2.onnx`

2. **Đặt Model vào thư mục:**
   - Tạo thư mục: `C:\Models\` (hoặc thư mục khác)
   - Copy file `.onnx` vào thư mục đó
   - Đảm bảo SQL Server service account có quyền đọc

3. **Chạy SQL Script:**
   - Mở file `CREATE_EXTERNAL_MODEL.sql`
   - Uncomment phần OPTION 2
   - Thay đường dẫn trong `LOCATION` bằng đường dẫn thực tế
   - Chạy script

4. **Test:**
   ```sql
   SELECT AI_GENERATE_EMBEDDINGS(
       'local_onnx_embeddings',
       NULL,
       'Test text'
   ) AS EmbeddingVector;
   ```

### Nếu chọn Option 3: REST Endpoint (Python API)

1. **Đảm bảo Python API đang chạy:**
   ```bash
   cd C:\MyData\projects\THITHI\THITHI_python-api
   run-server.bat
   ```

2. **Test Python API:**
   ```bash
   curl -X POST http://localhost:5005/vectorize -H "Content-Type: application/json" -d "{\"texts\": [\"Test\"]}"
   ```

3. **Chạy SQL Script:**
   - Mở file `CREATE_EXTERNAL_MODEL.sql`
   - Uncomment phần OPTION 3
   - Chạy script

4. **Test:**
   ```sql
   SELECT AI_GENERATE_EMBEDDINGS(
       'python_api_embeddings',
       NULL,
       'Test text'
   ) AS EmbeddingVector;
   ```

---

## Bước 3: Cấu hình appsettings.json

Sau khi tạo EXTERNAL MODEL, cập nhật `appsettings.json`:

```json
{
  "Embedding": {
    "Type": "SQL_SERVER",
    "ModelName": "azure_openai_embeddings"  // Tên EXTERNAL MODEL bạn vừa tạo
  }
}
```

**Lưu ý:** Tên `ModelName` phải khớp với tên EXTERNAL MODEL trong SQL Server.

---

## Bước 4: Kiểm tra

1. **Kiểm tra EXTERNAL MODEL đã tạo:**
   ```sql
   SELECT * FROM sys.external_models;
   ```

2. **Test generate embedding:**
   ```sql
   SELECT AI_GENERATE_EMBEDDINGS(
       'your_model_name',
       'text-embedding-3-small',  -- NULL nếu dùng ONNX hoặc REST
       'Máy Bơm - Model X'
   ) AS EmbeddingVector;
   ```

3. **Import Excel và kiểm tra logs:**
   - Import Excel như bình thường
   - Kiểm tra logs backend để xem có lỗi không
   - Kiểm tra database: `SELECT TOP 3 ID, Content, VectorJson, Embedding FROM [TSMay]`

---

## Troubleshooting

### Lỗi: "EXTERNAL MODEL không tồn tại"
- Kiểm tra tên model trong `appsettings.json` có khớp không
- Chạy `SELECT * FROM sys.external_models;` để xem danh sách

### Lỗi: "AI_GENERATE_EMBEDDINGS không được nhận diện"
- Đảm bảo đang dùng SQL Server 2025 (không phải 2022)
- Kiểm tra version: `SELECT @@VERSION;`

### Lỗi: "Azure OpenAI authentication failed"
- Kiểm tra API key có đúng không
- Kiểm tra endpoint URL có đúng không
- Kiểm tra network connectivity từ SQL Server đến Azure

### Lỗi: "Cannot access ONNX model file"
- Kiểm tra đường dẫn file có đúng không
- Kiểm tra SQL Server service account có quyền đọc file không
- Thử đặt file vào thư mục khác (ví dụ: `C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Data\`)

---

## Khuyến nghị

**Nếu có Azure subscription:** Dùng Option 1 (Azure OpenAI) - dễ nhất và tốt nhất.

**Nếu không có Azure:** Dùng Option 2 (ONNX) hoặc Option 3 (Python API).

**Nếu muốn giữ Python API hiện tại:** Dùng Option 3, nhưng vẫn cần Python server chạy.
