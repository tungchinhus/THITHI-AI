# Quick Start - Ingest Folder vào RAG System

## ⚡ 3 Bước Đơn Giản

### Bước 1: Setup từ Firebase (30 giây)

```batch
setup-firebase-secrets.bat
```

Script này sẽ:
- ✅ Tự động lấy GEMINI_API_KEY từ Firebase Functions
- ✅ Set FOLDER_PATH mặc định: `C:\MyData\P-TK\TBKT-25140T-250kVA`
- ✅ Set SQL Server config

### Bước 2: Chỉnh sửa Folder Path (nếu cần)

Mở `ingest-folder.bat` và chỉnh sửa dòng 6:
```batch
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA
```

### Bước 3: Chạy Ingest

Double-click `ingest-folder.bat`

## ✅ Kết Quả

Sau khi chạy, bạn sẽ thấy:
```
✅ Ingest thành công!
   Total files: 15
   Total chunks: 234
```

## 💬 Sau Đó - Chat để Tìm Thông Tin

```batch
chat-rag.bat
```

Nhập câu hỏi: "TBKT-25140T có công suất bao nhiêu?"

## 🎯 Tất Cả Trong Một

```batch
REM 1. Setup từ Firebase
setup-firebase-secrets.bat

REM 2. Ingest folder
ingest-folder.bat

REM 3. Chat
chat-rag.bat
```

## 📝 Lưu Ý

- **GEMINI_API_KEY:** Tự động lấy từ Firebase, không cần set thủ công
- **FOLDER_PATH:** Chỉnh sửa trong `ingest-folder.bat` nếu cần
- **SQL Server:** Mặc định localhost, có thể thay đổi trong `setup-firebase-secrets.bat`

## 🐛 Troubleshooting

**"GEMINI_API_KEY chưa được set"**
→ Chạy `setup-firebase-secrets.bat` trước

**"Folder không tồn tại"**
→ Chỉnh sửa FOLDER_PATH trong `ingest-folder.bat`

**"SQL Server connection failed"**
→ Kiểm tra SQL Server đang chạy

Xem chi tiết trong [HUONG_DAN_INGEST_FOLDER.md](HUONG_DAN_INGEST_FOLDER.md)
