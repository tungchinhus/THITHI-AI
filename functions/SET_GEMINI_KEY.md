# Set GEMINI_API_KEY vào Firebase

## ⚡ Quick Set

Đã tạo script để set GEMINI_API_KEY vào Firebase Secrets:

### Cách 1: Script đầy đủ (Khuyến nghị)

```batch
set-gemini-key.bat
```

Script này sẽ:
- ✅ Kiểm tra Firebase CLI
- ✅ Tự động login Firebase nếu cần
- ✅ Set GEMINI_API_KEY vào Firebase Secrets
- ✅ Test lấy lại để xác nhận

### Cách 2: Quick Set (Nhanh)

```batch
set-gemini-key-quick.bat
```

Script này sẽ set ngay mà không kiểm tra (nhanh hơn).

### Cách 3: Set thủ công

```batch
echo YOUR_GEMINI_API_KEY_HERE | firebase functions:secrets:set GEMINI_API_KEY
```

## ✅ Sau khi set

Sau khi set thành công, bạn có thể:

1. **Chạy ingest folder:**
   ```batch
   ingest-folder.bat
   ```

2. **Hoặc chat với RAG:**
   ```batch
   chat-rag.bat
   ```

## 🔍 Kiểm tra

Để kiểm tra secret đã được set:

```batch
firebase functions:secrets:access GEMINI_API_KEY
```

Nếu hiển thị API key → ✅ Đã set thành công!

## 📝 Lưu ý

- **API Key:** Lấy từ https://aistudio.google.com/app/apikey và thay thế `YOUR_GEMINI_API_KEY_HERE`
- **Firebase:** Phải login Firebase trước khi set
- **Quyền:** Phải có quyền truy cập Firebase project

## 🎯 Workflow

```batch
REM 1. Set GEMINI_API_KEY vào Firebase
set-gemini-key.bat

REM 2. Ingest folder
ingest-folder.bat

REM 3. Chat
chat-rag.bat
```
