# Backend Quick Start - THIHI AI

Hướng dẫn nhanh để chạy backend trong 2 phút.

## ⚡ Chạy Nhanh

### Terminal 1: Python API

```powershell
cd ..\THITHI_python-api
python app.py
```

**Đợi:** Model download lần đầu (~5-10 phút)
**Thành công khi thấy:** `Running on http://0.0.0.0:5005`

### Terminal 2: .NET Backend

```powershell
cd backend\THIHI_AI.Backend
dotnet run
```

**Thành công khi thấy:** `Now listening on: http://localhost:5000`

## ✅ Test

```powershell
# Test Python API
Invoke-WebRequest -Uri http://localhost:5005/health

# Test .NET Backend  
Invoke-WebRequest -Uri http://localhost:5000/api/vectorimport/health
```

## 📋 Checklist

- [ ] SQL Server đang chạy
- [ ] Database `THITHI_AI` đã tạo
- [ ] Python API chạy tại port 5005
- [ ] .NET Backend chạy tại port 5000
- [ ] Cả 2 health endpoints trả về OK

## 🔧 Cấu Hình

### SQL Server Connection

File: `backend/THIHI_AI.Backend/appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=THITHI_AI;Integrated Security=true;TrustServerCertificate=true;"
  }
}
```

### Python API URL

Đã cấu hình sẵn: `http://localhost:5005/vectorize`

## 📚 Chi Tiết

Xem file: [HUONG_DAN_SETUP_BACKEND.md](HUONG_DAN_SETUP_BACKEND.md)
