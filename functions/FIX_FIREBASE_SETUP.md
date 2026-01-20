# Fix: Không thể lấy GEMINI_API_KEY từ Firebase

## 🔍 Vấn Đề

Khi chạy `ingest-folder.bat`, script không thể lấy GEMINI_API_KEY từ Firebase.

## ✅ Giải Pháp

### Cách 1: Chạy Script Auto Setup (Khuyến nghị)

```batch
ingest-folder-auto.bat
```

Script này sẽ:
1. Tự động setup từ Firebase
2. Tự động login Firebase nếu cần
3. Lấy GEMINI_API_KEY
4. Chạy ingest

### Cách 2: Setup Thủ Công

**Bước 1: Login Firebase**
```batch
firebase login
```

**Bước 2: Setup Secrets**
```batch
setup-firebase-secrets.bat
```

**Bước 3: Chạy Ingest**
```batch
ingest-folder.bat
```

### Cách 3: Set API Key Thủ Công (Tạm thời)

Nếu không thể lấy từ Firebase, có thể set thủ công:

```batch
set GEMINI_API_KEY=your_api_key_here
ingest-folder.bat
```

## 🔧 Kiểm Tra

### 1. Firebase CLI đã cài chưa?
```batch
firebase --version
```

Nếu chưa có:
```batch
npm install -g firebase-tools
```

### 2. Đã login Firebase chưa?
```batch
firebase projects:list
```

Nếu chưa login:
```batch
firebase login
```

### 3. Secret đã được set chưa?
```batch
firebase functions:secrets:access GEMINI_API_KEY
```

Nếu chưa có:
```batch
echo YOUR_API_KEY | firebase functions:secrets:set GEMINI_API_KEY
```

## 📝 Quick Fix

Chạy script này để tự động fix:

```batch
ingest-folder-auto.bat
```

Script sẽ tự động:
- ✅ Kiểm tra Firebase CLI
- ✅ Login Firebase nếu cần
- ✅ Lấy GEMINI_API_KEY
- ✅ Chạy ingest

## 🎯 Workflow Đúng

```batch
REM 1. Setup từ Firebase (một lần)
setup-firebase-secrets.bat

REM 2. Ingest folder
ingest-folder.bat
```

Hoặc dùng script tự động:

```batch
ingest-folder-auto.bat
```
