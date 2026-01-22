# Fix: GEMINI_API_KEY không được nhận trong PowerShell

## Vấn đề

Khi chạy `node test-folder-ingest.js` trực tiếp trong PowerShell sau khi dùng lệnh `set GEMINI_API_KEY=...`, Node.js không nhận được biến môi trường.

**Nguyên nhân:** PowerShell `set` không set environment variables. Trong PowerShell, cần dùng `$env:VAR="value"`.

## Giải pháp

### Cách 1: Dùng Batch File (Khuyến nghị)

Chạy batch file trực tiếp (double-click hoặc từ CMD):

```cmd
ingest-folder.bat
```

Hoặc từ PowerShell:

```powershell
cmd /c ingest-folder.bat
```

### Cách 2: Dùng PowerShell Script

Chạy script PowerShell:

```powershell
.\ingest-folder.ps1
```

### Cách 3: Set biến trong PowerShell rồi chạy Node

```powershell
$env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
$env:SQL_SERVER_HOST="localhost"
$env:SQL_SERVER_DATABASE="THITHI_AI"
$env:SQL_SERVER_USER="sa"
$env:SQL_SERVER_PASSWORD="123456"
node test-folder-ingest.js
```

### Cách 4: Dùng Wrapper Script

```cmd
ingest-folder-wrapper.bat
```

## So sánh cú pháp

| Shell | Set Environment Variable | Đọc trong Node.js |
|-------|------------------------|-------------------|
| **CMD** | `set VAR=value` | ✅ `process.env.VAR` |
| **PowerShell** | `$env:VAR="value"` | ✅ `process.env.VAR` |
| **PowerShell** | `set VAR=value` | ❌ Không hoạt động |

## Kiểm tra

Sau khi set biến, kiểm tra trong Node.js:

```javascript
console.log(process.env.GEMINI_API_KEY); // Phải có giá trị
```

## Files liên quan

- `ingest-folder.bat` - Batch file cho CMD
- `ingest-folder.ps1` - PowerShell script
- `ingest-folder-wrapper.bat` - Wrapper script với verification
- `test-folder-ingest.js` - Test script
