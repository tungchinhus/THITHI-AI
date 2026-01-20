# Hướng Dẫn Dừng Backend Khi Port 5000 Bị Chiếm

## 🔴 Lỗi: "address already in use" - Port 5000 đã được sử dụng

Khi gặp lỗi này, có nghĩa là có một instance của backend đang chạy và chiếm port 5000.

## ✅ Giải Pháp

### Cách 1: Dùng Task Manager (Dễ nhất) ⭐

1. Mở **Task Manager** (Ctrl + Shift + Esc)
2. Tìm tab **"Details"** hoặc **"Chi tiết"**
3. Tìm các process:
   - `THIHI_AI.Backend`
   - `dotnet.exe`
4. Click chuột phải → **End Task** hoặc **Kết thúc tác vụ**

### Cách 2: Dùng PowerShell với quyền Administrator

1. Mở **PowerShell** với quyền Administrator:
   - Click chuột phải vào PowerShell
   - Chọn **"Run as Administrator"**

2. Chạy lệnh:
```powershell
# Tìm process đang dùng port 5000
Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess

# Dừng process (thay PID bằng số bạn tìm được)
Stop-Process -Id <PID> -Force

# Hoặc dừng tất cả process dotnet
Get-Process -Name "dotnet" | Stop-Process -Force
```

### Cách 3: Dùng Command Prompt với quyền Administrator

1. Mở **Command Prompt** với quyền Administrator
2. Chạy:
```cmd
# Tìm process đang dùng port 5000
netstat -ano | findstr :5000

# Dừng process (thay PID bằng số bạn tìm được)
taskkill /F /PID <PID>
```

### Cách 4: Đổi Port của Backend (Nếu không thể dừng process)

Nếu không thể dừng process, bạn có thể đổi port của backend:

1. Mở file `appsettings.json` hoặc `launchSettings.json` trong project backend
2. Tìm và đổi port từ `5000` sang port khác (ví dụ: `5001`, `5002`)
3. Cập nhật URL trong Angular frontend để trỏ đến port mới

## 🔍 Kiểm Tra Port Đã Trống

Sau khi dừng process, kiểm tra lại:

```powershell
netstat -ano | findstr :5000
```

Nếu không có output, nghĩa là port đã trống và bạn có thể start backend lại.

## 🚀 Start Backend Lại

Sau khi port đã trống:

```powershell
cd C:\MyData\projects\THITHI\THIHI_AI\backend\THIHI_AI.Backend
dotnet run
```

## ⚠️ Lưu Ý

- Nếu process không dừng được, có thể cần **restart máy tính**
- Hoặc đổi port backend sang port khác
- Đảm bảo đóng tất cả terminal/IDE đang chạy backend trước khi start lại
