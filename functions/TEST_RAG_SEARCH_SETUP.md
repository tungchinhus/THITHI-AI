# Hướng dẫn chạy test-rag-search-debug.js

## ⚠️ Lỗi: Cannot find module 'dotenv'

Script đã được sửa để **không cần dotenv**. Bạn có thể chạy trực tiếp với environment variables.

## 🔧 Cách 1: Set Environment Variables (Khuyến nghị)

### Windows PowerShell:

```powershell
# Set SQL Server
$env:SQL_SERVER_HOST = "localhost"
$env:SQL_SERVER_DATABASE = "THITHI_AI"
$env:SQL_SERVER_PORT = "1433"

# Nếu dùng SQL Server Authentication (không bắt buộc nếu dùng Windows Auth)
$env:SQL_SERVER_USER = "sa"
$env:SQL_SERVER_PASSWORD = "your-password"

# Set Gemini API Key
$env:GEMINI_API_KEY = "your-gemini-api-key"

# Chạy script
node test-rag-search-debug.js
```

### Windows CMD:

```cmd
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_PORT=1433
set GEMINI_API_KEY=your-gemini-api-key

node test-rag-search-debug.js
```

### Linux/Mac Bash:

```bash
export SQL_SERVER_HOST=localhost
export SQL_SERVER_DATABASE=THITHI_AI
export SQL_SERVER_PORT=1433
export GEMINI_API_KEY=your-gemini-api-key

node test-rag-search-debug.js
```

## 🔧 Cách 2: Tạo file .env (Nếu muốn dùng dotenv)

### Bước 1: Cài đặt dotenv

```bash
npm install dotenv
```

### Bước 2: Tạo file `.env` trong thư mục `functions`

```env
SQL_SERVER_HOST=localhost
SQL_SERVER_DATABASE=THITHI_AI
SQL_SERVER_PORT=1433
SQL_SERVER_USER=sa
SQL_SERVER_PASSWORD=your-password
GEMINI_API_KEY=your-gemini-api-key
```

### Bước 3: Chạy script

```bash
node test-rag-search-debug.js
```

## 🔧 Cách 3: Lấy từ Firebase Secrets (Nếu đã deploy)

Nếu bạn đã deploy Firebase Functions và có secrets, có thể lấy:

```bash
# Lấy SQL Server config
firebase functions:secrets:access SQL_SERVER_HOST
firebase functions:secrets:access SQL_SERVER_DATABASE
firebase functions:secrets:access SQL_SERVER_USER
firebase functions:secrets:access SQL_SERVER_PASSWORD

# Lấy Gemini API key
firebase functions:secrets:access GEMINI_API_KEY
```

Sau đó set vào environment variables như Cách 1.

## ✅ Kiểm tra

Script sẽ tự động kiểm tra và hiển thị:

```
0️⃣ Checking environment variables...
   SQL_SERVER_HOST: localhost
   SQL_SERVER_DATABASE: THITHI_AI
   SQL_SERVER_USER: ⚠️ not set (will use Windows Auth)
   GEMINI_API_KEY: ✅ set
```

Nếu thiếu biến nào, script sẽ báo lỗi và hướng dẫn cách set.

## 🐛 Troubleshooting

### Lỗi: "SQL_SERVER_HOST is required"

**Giải pháp:** Set environment variable:
```powershell
$env:SQL_SERVER_HOST = "localhost"
```

### Lỗi: "GEMINI_API_KEY not found"

**Giải pháp:** Set API key:
```powershell
$env:GEMINI_API_KEY = "your-api-key"
```

### Lỗi: "SQL Server connection failed"

**Kiểm tra:**
1. SQL Server có đang chạy không?
2. Connection string có đúng không?
3. Firewall có chặn port 1433 không?

### Lỗi: "Table rag_documents does not exist"

**Giải pháp:** Chạy ingest trước:
```bash
node test-folder-ingest.js
```

## 📝 Notes

- Script không cần `dotenv` nữa, nhưng vẫn hỗ trợ nếu bạn cài đặt
- Windows Authentication sẽ được dùng nếu không set SQL_SERVER_USER
- Script sẽ hiển thị đầy đủ thông tin debug để bạn biết vấn đề ở đâu
