# Quick Fix - GEMINI_API_KEY không lấy được từ Firebase

## 🚨 Vấn Đề

Script không thể lấy GEMINI_API_KEY từ Firebase Secrets.

## ⚡ Giải Pháp Nhanh

### Cách 1: Chạy Script Check (Khuyến nghị)

```batch
check-firebase.bat
```

Script này sẽ:
- ✅ Kiểm tra Firebase CLI
- ✅ Tự động login Firebase nếu cần
- ✅ Kiểm tra và set GEMINI_API_KEY secret
- ✅ Test lấy GEMINI_API_KEY

### Cách 2: Fix Thủ Công

**Bước 1: Login Firebase**
```batch
firebase login
```

**Bước 2: Kiểm tra Secret**
```batch
firebase functions:secrets:access GEMINI_API_KEY
```

Nếu không thấy GEMINI_API_KEY, set nó:
```batch
echo YOUR_API_KEY | firebase functions:secrets:set GEMINI_API_KEY
```

**Bước 3: Test lấy Secret**
```batch
firebase functions:secrets:access GEMINI_API_KEY
```

**Bước 4: Chạy lại**
```batch
ingest-folder.bat
```

## 🎯 Workflow Đúng

```batch
REM 1. Check và fix Firebase setup
check-firebase.bat

REM 2. Ingest folder
ingest-folder.bat
```

Hoặc dùng script tự động:

```batch
ingest-folder-auto.bat
```

## 📝 Lưu Ý

- **Firebase CLI:** Phải cài đặt và login
- **Secret:** Phải được set trong Firebase
- **Project:** Phải chọn đúng project Firebase

## 🔍 Debug

Nếu vẫn lỗi, chạy:

```batch
check-firebase.bat
```

Script sẽ hiển thị chi tiết vấn đề và cách fix.
