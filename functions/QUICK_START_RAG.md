# Quick Start: ChatAI với PDF Files

## ⚠️ QUAN TRỌNG: Phải Ingest Folder TRƯỚC khi Chat!

## 🚀 Bước 1: Ingest Folder (BẮT BUỘC)

**Chạy script để nhập dữ liệu vào database:**

```cmd
cd C:\MyData\projects\THITHI\THIHI_AI\functions
ingest-folder-robust.bat
```

**Hoặc:**

```cmd
ingest-folder.bat
```

**Script sẽ:**
- ✅ Quét folder `C:\MyData\P-TK\TBKT-25140T-250kVA`
- ✅ Đọc tất cả PDF, Word, Excel, TXT files
- ✅ Chia nhỏ thành chunks
- ✅ Tạo embeddings (dùng Gemini AI)
- ✅ Lưu vào SQL Server

**Khi thành công, bạn sẽ thấy:**
```
✅ Ingest completed!
   Total files: X
   Total chunks: Y
```

## 💬 Bước 2: Chat để Tìm Thông Tin

**Sau khi ingest xong, chạy:**

```cmd
chat-rag.bat
```

**Nhập câu hỏi, ví dụ:**
- "TBKT-25140T có công suất bao nhiêu?"
- "Thông số kỹ thuật của máy"
- "Hướng dẫn lắp đặt"

## ❌ Lỗi Thường Gặp

### "Found 0 records with VectorJson"

**Nguyên nhân:** Chưa ingest folder

**Giải pháp:**
1. Chạy `ingest-folder-robust.bat` trước
2. Đợi ingest hoàn tất (thấy "Total chunks: XXX")
3. Sau đó mới chạy `chat-rag.bat`

### "VECTOR_DISTANCE failed"

**Nguyên nhân:** SQL Server không hỗ trợ native VECTOR_DISTANCE

**Giải pháp:** Hệ thống tự động fallback về JavaScript calculation - không cần làm gì!

## ✅ Checklist

Trước khi chat, đảm bảo:
- [ ] Đã chạy `ingest-folder-robust.bat`
- [ ] Ingest thành công (thấy "Total chunks: XXX")
- [ ] SQL Server đang chạy
- [ ] GEMINI_API_KEY đã set

## 📝 Lưu Ý

1. **Chỉ cần ingest một lần** - Sau đó có thể chat nhiều lần
2. **Nếu thêm file mới vào folder** - Cần ingest lại
3. **Ingest có thể mất thời gian** - Tùy số lượng files

## 🎯 Workflow Đúng

```
1. Ingest folder → ingest-folder-robust.bat
2. Đợi hoàn tất → Thấy "Total chunks: XXX"
3. Chat → chat-rag.bat
4. Nhập câu hỏi → Nhận câu trả lời + sources
```
