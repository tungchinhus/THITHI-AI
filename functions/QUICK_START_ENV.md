# Quick Start: Set Environment Variables

## ✅ Cách ĐÚNG (Khuyến nghị)

### Option 1: Chạy Batch File (Dễ nhất)
```cmd
ingest-folder.bat
```
**Lưu ý:** Chạy từ CMD hoặc double-click file, KHÔNG chạy từ PowerShell với `.\ingest-folder.bat`

### Option 2: Chạy PowerShell Script
```powershell
.\ingest-folder.ps1
```

### Option 3: Set biến trong PowerShell rồi chạy Node
```powershell
$env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
$env:SQL_SERVER_HOST="localhost"
$env:SQL_SERVER_DATABASE="THITHI_AI"
$env:SQL_SERVER_USER="sa"
$env:SQL_SERVER_PASSWORD="123456"
node test-folder-ingest.js
```

## ❌ Cách SAI (Không hoạt động)

```powershell
# ❌ SAI - PowerShell không nhận lệnh set
set GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
node test-folder-ingest.js
```

## Kiểm tra

Sau khi set biến, kiểm tra:
```powershell
# PowerShell
$env:GEMINI_API_KEY

# CMD
echo %GEMINI_API_KEY%
```

## Logs cho thấy

Các lần chạy gần đây (theo debug.log):
- ✅ GEMINI_API_KEY được set đúng khi dùng cú pháp đúng
- ✅ Check passed
- ✅ SQL connection thành công

## Nếu vẫn lỗi

1. Kiểm tra bạn đang dùng shell nào (CMD hay PowerShell)
2. Kiểm tra cú pháp đúng cho shell đó
3. Chạy `test-env.bat` để verify environment variables hoạt động
4. Xem log tại: `c:\MyData\projects\THITHI\THIHI_AI\.cursor\debug.log`
