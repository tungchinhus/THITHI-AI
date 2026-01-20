# Hướng dẫn cấu hình SQL Server Connection

## Cách 1: Cập nhật appsettings.Development.json (Đơn giản nhất)

1. Mở file `appsettings.Development.json`
2. Tìm dòng `"Password=YOUR_PASSWORD_HERE"`
3. Thay `YOUR_PASSWORD_HERE` bằng mật khẩu SQL Server của bạn
4. Lưu file

**Ví dụ:**
```json
"DefaultConnection": "Server=.\\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=YourActualPassword123;TrustServerCertificate=true;Encrypt=true;"
```

## Cách 2: Sử dụng User Secrets (Bảo mật hơn)

### Bước 1: Khởi tạo User Secrets
```powershell
cd backend\THIHI_AI.Backend
dotnet user-secrets init
```

### Bước 2: Lưu mật khẩu vào User Secrets
```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=.\\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=YourActualPassword123;TrustServerCertificate=true;Encrypt=true;"
```

### Bước 3: Cập nhật appsettings.json
Thay đổi connection string trong `appsettings.json` để sử dụng placeholder hoặc để trống password (User Secrets sẽ override):

```json
"DefaultConnection": "Server=.\\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=;TrustServerCertificate=true;Encrypt=true;"
```

## Cách 3: Sử dụng Environment Variable

### Windows PowerShell:
```powershell
$env:ConnectionStrings__DefaultConnection = "Server=.\\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=YourPassword;TrustServerCertificate=true;Encrypt=true;"
```

### Windows CMD:
```cmd
set ConnectionStrings__DefaultConnection=Server=.\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=YourPassword;TrustServerCertificate=true;Encrypt=true;
```

## Kiểm tra kết nối

Sau khi cấu hình, khởi động backend và kiểm tra:

```powershell
cd backend\THIHI_AI.Backend
dotnet run --launch-profile http
```

Nếu có lỗi kết nối, kiểm tra:
1. SQL Server đang chạy
2. Instance name đúng: `.\MSSQLSERVER2025`
3. Username/password đúng
4. Database `THITHI_AI` đã được tạo (hoặc backend sẽ tự tạo nếu có quyền)

## Lưu ý bảo mật

- ⚠️ **KHÔNG** commit file `appsettings.Development.json` nếu có chứa mật khẩu thật
- ✅ Sử dụng User Secrets hoặc Environment Variables cho production
- ✅ File `appsettings.Development.json` nên được thêm vào `.gitignore`
