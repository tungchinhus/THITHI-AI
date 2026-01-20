# 🚀 Bắt Đầu Ở Đây - Quick Start

## ⚡ Cách Nhanh Nhất

### Bước 1: Set GEMINI_API_KEY

**Option 1: Set trong Terminal (Nhanh nhất)**
```batch
set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
```

**Option 2: Set vào Firebase (Một lần)**
```batch
set-gemini-key.bat
```

### Bước 2: Chạy Ingest

```batch
ingest-folder.bat
```

## 📋 Workflow Đầy Đủ

```batch
REM 1. Set GEMINI_API_KEY (chọn 1 trong 2)
REM Option A: Set trong terminal
set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE

REM Option B: Set vào Firebase
set-gemini-key.bat

REM 2. Ingest folder
ingest-folder.bat

REM 3. Chat với RAG
chat-rag.bat
```

## ✅ Script Ưu Tiên

Script `ingest-folder.bat` sẽ tự động:
1. ✅ **Ưu tiên:** Sử dụng GEMINI_API_KEY từ environment variable (nếu đã set)
2. ✅ **Fallback:** Tự động lấy từ Firebase Secrets nếu chưa có trong environment
3. ✅ **Auto login:** Tự động login Firebase nếu cần

## 🎯 Lưu Ý

- **Environment Variable:** Nếu bạn đã set `set GEMINI_API_KEY=...` trong terminal, script sẽ dùng giá trị đó
- **Firebase Secrets:** Nếu chưa set trong environment, script sẽ tự động lấy từ Firebase
- **Session:** Environment variable chỉ tồn tại trong session terminal hiện tại

## 💡 Tips

**Để GEMINI_API_KEY tồn tại lâu hơn:**
- Set vào Firebase: `set-gemini-key.bat` (khuyến nghị)
- Hoặc set trong System Environment Variables

**Để test nhanh:**
- Set trong terminal: `set GEMINI_API_KEY=your_key`
- Chạy: `ingest-folder.bat`
