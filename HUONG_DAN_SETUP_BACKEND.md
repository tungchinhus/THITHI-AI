# Hướng Dẫn Setup Backend - THIHI AI

Hướng dẫn đầy đủ để setup và chạy .NET Backend API và Python Vectorize API.

## 📋 Tổng Quan

Hệ thống backend gồm 2 phần:
1. **.NET Backend API** (ASP.NET Core) - Port 5000/5001
   - Đọc Excel file
   - Gọi Python API để vectorize
   - Lưu vào SQL Server

2. **Python Vectorize API** (Flask) - Port 5005
   - Nhận text và trả về vector embeddings
   - Sử dụng sentence-transformers

## 🚀 Quick Start

### Cách 1: Start Tự Động (Khuyến nghị) ⚡

**Windows Batch:**
```bash
start-all-services.bat
```

**PowerShell:**
```powershell
.\start-all-services.ps1
```

Script sẽ tự động mở 2 cửa sổ riêng biệt:
- Python Vectorize API (Port 5005)
- .NET Backend API (Port 5000)

**Kiểm tra trạng thái:**
```bash
check-services.bat
```

**Dừng tất cả services:**
```bash
stop-all-services.bat
```

### Cách 2: Start Thủ Công

#### Bước 1: Chạy Python API

```powershell
cd python-api
start-simple.bat
```

Hoặc:
```powershell
cd python-api
venv\Scripts\activate
python app.py
```

**Lưu ý:** Lần đầu sẽ download model (~400MB), đợi 5-10 phút.

Khi thấy log: `Running on http://0.0.0.0:5005` → ✅ Python API đã sẵn sàng!

#### Bước 2: Chạy .NET Backend

Mở terminal mới:

```powershell
cd backend\THIHI_AI.Backend
dotnet run
```

Khi thấy log: `Now listening on: http://localhost:5000` → ✅ .NET Backend đã sẵn sàng!

#### Bước 3: Test

```powershell
# Test Python API
Invoke-WebRequest -Uri http://localhost:5005/health -UseBasicParsing

# Test .NET Backend
Invoke-WebRequest -Uri http://localhost:5000/api/vectorimport/health -UseBasicParsing
```

## 📦 Yêu Cầu Hệ Thống

### .NET Backend
- ✅ .NET SDK 9.0+ (đã có: 9.0.304)
- ✅ SQL Server (local hoặc remote)
- ✅ NuGet packages (đã cài đặt):
  - MiniExcel (v1.42.0)
  - Microsoft.Data.SqlClient (v6.1.3)
  - System.Text.Json (v10.0.2)

### Python API
- ✅ Python 3.10+ (đã có: 3.10.11)
- ✅ Dependencies:
  - flask
  - flask-cors
  - sentence-transformers
  - numpy
  - torch

## 🔧 Cấu Hình Chi Tiết

### 1. SQL Server Connection

Cập nhật `backend/THIHI_AI.Backend/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=THITHI_AI;Integrated Security=true;TrustServerCertificate=true;"
  }
}
```

**Lưu ý:**
- `Server`: Tên server SQL (localhost hoặc IP)
- `Database`: Tên database (THITHI_AI)
- `Integrated Security=true`: Dùng Windows Authentication
- Nếu dùng SQL Authentication, thay bằng: `User Id=sa;Password=YourPassword;`

### 2. Python API URL

Đã cấu hình sẵn trong `appsettings.json`:

```json
{
  "PythonApi": {
    "VectorizeUrl": "http://localhost:5005/vectorize"
  }
}
```

Nếu Python API chạy port khác, cập nhật URL này.

## 📁 Cấu Trúc Project

```
THIHI_AI/
├── backend/
│   └── THIHI_AI.Backend/
│       ├── Controllers/
│       │   └── VectorImportController.cs
│       ├── Services/
│       │   └── VectorImportService.cs
│       ├── Program.cs
│       └── appsettings.json
│
└── python-api/
    ├── app.py
    ├── requirements.txt
    ├── README.md
    └── run.ps1
```

## 🔄 Quy Trình Hoạt Động

```
1. User upload Excel file
   ↓
2. .NET Backend đọc Excel (MiniExcel)
   ↓
3. Gộp các cột đã chọn thành text
   ↓
4. Gửi POST đến Python API /vectorize
   ↓
5. Python API trả về vectors
   ↓
6. .NET Backend lưu vào SQL Server
   ↓
7. Trả về kết quả cho user
```

## 📡 API Endpoints

### .NET Backend API

#### POST `/api/vectorimport/import`

Import Excel và vectorize.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Excel file (.xlsx, .xls)
  - `tableName`: Tên bảng SQL
  - `selectedColumns`: Array các cột cần xử lý

**Example (Postman):**
```
POST http://localhost:5000/api/vectorimport/import
Body: form-data
  - file: [chọn file Excel]
  - tableName: products
  - selectedColumns: Name
  - selectedColumns: Description
```

**Response:**
```json
{
  "message": "Import thành công",
  "fileName": "data.xlsx",
  "tableName": "products",
  "columns": ["Name", "Description"]
}
```

#### GET `/api/vectorimport/health`

Kiểm tra service hoạt động.

**Response:**
```json
{
  "status": "OK",
  "service": "VectorImportService"
}
```

### Python API

#### POST `/vectorize`

Vectorize text thành embeddings.

**Request:**
```json
{
  "texts": [
    "Máy Bơm - Model X - Công suất 5HP",
    "Máy Nén - Model Y"
  ]
}
```

**Response:**
```json
{
  "vectors": [
    [0.1, 0.2, 0.3, ...],
    [0.4, 0.5, 0.6, ...]
  ],
  "count": 2,
  "dimension": 384
}
```

#### GET `/health`

Kiểm tra service hoạt động.

**Response:**
```json
{
  "status": "OK",
  "service": "Python Vectorize API",
  "model_loaded": true
}
```

## 🗄️ SQL Server Schema

Bảng được tạo tự động khi import:

```sql
CREATE TABLE dbo.[TableName] (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Content NVARCHAR(MAX),           -- Text đã gộp
    VectorJson NVARCHAR(MAX)         -- Vector dạng JSON
);
```

## 🧪 Test Scripts

### Test Python API

```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:5005/health -UseBasicParsing

# Vectorize test
$body = @{
    texts = @("Máy Bơm - Model X", "Máy Nén - Model Y")
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:5005/vectorize `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing

$response.Content
```

### Test .NET Backend

```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:5000/api/vectorimport/health -UseBasicParsing

# Import test (cần file Excel)
# Sử dụng Postman hoặc curl để test với file thực tế
```

## ⚠️ Troubleshooting

### Lỗi: "Port 5005 already in use"

**Giải pháp:**
```powershell
# Tìm process đang dùng port
netstat -ano | findstr :5005

# Kill process (thay PID bằng process ID)
taskkill /PID <PID> /F
```

Hoặc đổi port trong `python-api/app.py`:
```python
app.run(host='0.0.0.0', port=5006, debug=True)
```

### Lỗi: "Port 5000 already in use"

**Giải pháp:**
Cập nhật `backend/THIHI_AI.Backend/Properties/launchSettings.json`:
```json
{
  "applicationUrl": "http://localhost:5002"
}
```

### Lỗi: "SQL Server connection failed"

**Kiểm tra:**
1. SQL Server đang chạy?
2. Connection string đúng?
3. Database đã tồn tại?
4. Quyền truy cập?

**Tạo database:**
```sql
CREATE DATABASE THITHI_AI;
GO
```

### Lỗi: "Python API không phản hồi"

**Kiểm tra:**
1. Python API đang chạy? (`http://localhost:5005/health`)
2. Model đã load xong? (kiểm tra logs)
3. URL trong `appsettings.json` đúng?

### Lỗi: "Model download failed"

**Giải pháp:**
1. Kiểm tra kết nối internet
2. Model sẽ được cache, lần sau sẽ nhanh hơn
3. Có thể download thủ công và đặt vào thư mục cache

## 📝 Checklist Setup

- [ ] Python 3.10+ đã cài đặt
- [ ] .NET SDK 9.0+ đã cài đặt
- [ ] SQL Server đang chạy
- [ ] Database `THITHI_AI` đã tạo
- [ ] Python dependencies đã cài (`pip install -r requirements.txt`)
- [ ] Python API chạy thành công (`http://localhost:5005/health`)
- [ ] .NET Backend chạy thành công (`http://localhost:5000/api/vectorimport/health`)
- [ ] Connection string đã cấu hình đúng
- [ ] Test import Excel thành công

## 🎯 Next Steps

1. **Tạo file Excel mẫu** để test import
2. **Tối ưu performance** với batch processing cho file lớn
3. **Thêm error handling** và retry logic
4. **Implement search** với vector similarity
5. **Deploy lên production** (Azure, AWS, etc.)

## 🛠️ Scripts Tiện Ích

### `start-all-services.bat` / `start-all-services.ps1`
Start cả Python API và .NET Backend cùng lúc trong 2 cửa sổ riêng biệt.

**Sử dụng:**
```bash
# Windows Batch
start-all-services.bat

# PowerShell
.\start-all-services.ps1
```

### `stop-all-services.bat`
Dừng tất cả services đang chạy trên port 5000 và 5005.

**Sử dụng:**
```bash
stop-all-services.bat
```

### `check-services.bat`
Kiểm tra trạng thái của các services và test health endpoints.

**Sử dụng:**
```bash
check-services.bat
```

**Output mẫu:**
```
========================================
  Checking Services Status
========================================

Checking Python API (Port 5005)...
[OK] Python API is running

Checking .NET Backend (Port 5000)...
[OK] .NET Backend is running

Testing endpoints...

Testing Python API health...
[OK] Python API health check passed

Testing .NET Backend health...
[OK] .NET Backend health check passed
```

## 📚 Tài Liệu Tham Khảo

- [.NET Backend README](backend/THIHI_AI.Backend/README.md)
- [Python API README](python-api/README.md)
- [SQL Server Vector Guide](HUONG_DAN_SQL_SERVER_VECTOR.md)

## 💡 Tips

1. **Development:** Chạy cả 2 services trong 2 terminal riêng để dễ debug
2. **Production:** Sử dụng process manager (PM2, Supervisor) hoặc Docker
3. **Performance:** Với file lớn (>1000 rows), nên chia batch khi gọi Python API
4. **Security:** Thêm authentication/authorization cho production
5. **Monitoring:** Thêm logging và monitoring (Application Insights, etc.)

---

**Cần hỗ trợ?** Kiểm tra logs của cả 2 services để tìm lỗi chi tiết.
