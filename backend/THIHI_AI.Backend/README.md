# THIHI AI Backend - Vector Import Service

## Tổng quan

Backend API sử dụng ASP.NET Core để xử lý import Excel, vectorize dữ liệu và lưu vào SQL Server.

## Tính năng

- ✅ Đọc Excel file (MiniExcel)
- ✅ Gửi dữ liệu sang Python API để vectorize
- ✅ Lưu vào SQL Server với bảng động
- ✅ Transaction-safe để đảm bảo tính toàn vẹn dữ liệu

## Cấu trúc Project

```
THIHI_AI.Backend/
├── Controllers/
│   └── VectorImportController.cs    # API endpoints
├── Services/
│   └── VectorImportService.cs        # Business logic
├── Program.cs                        # Dependency injection setup
└── appsettings.json                  # Configuration
```

## Cấu hình

### 1. Connection String (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=THIHI_AI_DB;Integrated Security=true;TrustServerCertificate=true;"
  }
}
```

### 2. Python API URL (appsettings.json)

```json
{
  "PythonApi": {
    "VectorizeUrl": "http://localhost:5005/vectorize"
  }
}
```

## API Endpoints

### POST `/api/vectorimport/import`

Import Excel file và vectorize dữ liệu.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Parameters:
  - `file`: Excel file (.xlsx, .xls)
  - `tableName`: Tên bảng SQL để lưu dữ liệu
  - `selectedColumns`: Danh sách các cột cần xử lý (array)

**Example using cURL:**
```bash
curl -X POST "https://localhost:5001/api/vectorimport/import" \
  -F "file=@data.xlsx" \
  -F "tableName=products" \
  -F "selectedColumns=Name" \
  -F "selectedColumns=Description" \
  -F "selectedColumns=Category"
```

**Example using Postman:**
1. Method: POST
2. URL: `https://localhost:5001/api/vectorimport/import`
3. Body: form-data
   - `file`: [Select File]
   - `tableName`: products
   - `selectedColumns`: Name (add more rows for multiple columns)

**Response:**
```json
{
  "message": "Import thành công",
  "fileName": "data.xlsx",
  "tableName": "products",
  "columns": ["Name", "Description", "Category"]
}
```

### GET `/api/vectorimport/health`

Kiểm tra service hoạt động.

**Response:**
```json
{
  "status": "OK",
  "service": "VectorImportService"
}
```

## Quy trình xử lý

1. **Đọc Excel**: Sử dụng MiniExcel để đọc file Excel
2. **Gộp dữ liệu**: Nối các cột đã chọn thành một chuỗi (ví dụ: "Máy Bơm - Model X - Công suất 5HP")
3. **Vectorize**: Gửi dữ liệu đến Python API để tạo vector embeddings
4. **Lưu SQL**: 
   - Tạo bảng động nếu chưa tồn tại
   - Insert dữ liệu với transaction để đảm bảo tính toàn vẹn

## Cấu trúc bảng SQL

Bảng được tạo tự động với cấu trúc:

```sql
CREATE TABLE dbo.[TableName] (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Content NVARCHAR(MAX),           -- Text đã gộp từ các cột
    VectorJson NVARCHAR(MAX)         -- Vector dạng JSON string
);
```

## Python API Format

Python API cần trả về format:

```json
{
  "vectors": [
    [0.1, 0.2, 0.3, ...],
    [0.4, 0.5, 0.6, ...]
  ]
}
```

## Chạy Project

```bash
cd backend/THIHI_AI.Backend
dotnet run
```

API sẽ chạy tại:
- HTTP: `http://localhost:5000`
- HTTPS: `https://localhost:5001`

## Dependencies

- **MiniExcel** (v1.42.0) - Đọc Excel nhanh
- **Microsoft.Data.SqlClient** (v6.1.3) - Kết nối SQL Server
- **System.Text.Json** (v10.0.2) - Xử lý JSON

## Lưu ý

1. **SQL Injection Protection**: Tên bảng được sanitize (chỉ cho phép chữ cái, số, dấu gạch dưới)
2. **Transaction**: Sử dụng transaction để đảm bảo rollback nếu có lỗi
3. **Batch Processing**: Với file lớn (>1000 dòng), nên chia nhỏ để gửi đến Python API
4. **Error Handling**: Tất cả lỗi được log và trả về response phù hợp

## Troubleshooting

### Lỗi kết nối SQL Server
- Kiểm tra connection string trong `appsettings.json`
- Đảm bảo SQL Server đang chạy
- Kiểm tra quyền truy cập database

### Lỗi Python API
- Kiểm tra Python API đang chạy tại URL đã cấu hình
- Kiểm tra format response từ Python API
- Xem logs để biết chi tiết lỗi

### Lỗi đọc Excel
- Đảm bảo file là định dạng .xlsx hoặc .xls
- Kiểm tra file không bị corrupt
- Kiểm tra các cột được chọn có tồn tại trong file
