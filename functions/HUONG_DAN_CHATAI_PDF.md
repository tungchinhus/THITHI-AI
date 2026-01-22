# Hướng Dẫn: ChatAI Trích Lục Thông Tin Từ Folder Nhiều PDF

## 🎯 Tổng Quan

Hệ thống RAG (Retrieval-Augmented Generation) cho phép ChatAI tìm kiếm và trích lục thông tin từ nhiều file PDF (và các file khác) trong một folder.

## 📋 Quy Trình 2 Bước

### Bước 1: Ingest Folder (Nhập dữ liệu vào hệ thống)
### Bước 2: Chat để tìm thông tin

---

## 🚀 Bước 1: Ingest Folder

### Cách 1: Dùng Batch File (Dễ nhất) ⭐

```cmd
cd C:\MyData\projects\THITHI\THIHI_AI\functions
ingest-folder-robust.bat
```

**Hoặc:**

```cmd
ingest-folder.bat
```

**Script sẽ:**
1. ✅ Quét toàn bộ folder (bao gồm subfolders)
2. ✅ Tìm tất cả file PDF, Word, Excel, TXT
3. ✅ Đọc nội dung từng file
4. ✅ Chia nhỏ thành các đoạn (chunks)
5. ✅ Tạo vector embeddings (dùng Gemini AI)
6. ✅ Lưu vào SQL Server với vector search

**Ví dụ output:**
```
✅ Ingest completed!
   Total files: 15
   Total chunks: 234

📋 File details:
   1. ✅ document1.pdf - 45 chunks
   2. ✅ spec.xlsx - 12 chunks
   3. ✅ manual.docx - 67 chunks
```

### Cách 2: Chạy Trực Tiếp Node.js

```cmd
cd C:\MyData\projects\THITHI\THIHI_AI\functions

REM Set environment variables
set GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
set SQL_SERVER_HOST=localhost
set SQL_SERVER_DATABASE=THITHI_AI
set SQL_SERVER_USER=sa
set SQL_SERVER_PASSWORD=123456
set FOLDER_PATH=C:\MyData\P-TK\TBKT-25140T-250kVA

REM Chạy ingest
node test-folder-ingest.js
```

---

## 💬 Bước 2: Chat để Tìm Thông Tin

Sau khi ingest xong, bạn có thể chat để tìm thông tin:

### Cách 1: Dùng Batch File (Dễ nhất) ⭐

```cmd
cd C:\MyData\projects\THITHI\THIHI_AI\functions
chat-rag.bat
```

Script sẽ hỏi bạn nhập câu hỏi, ví dụ:
```
Nhập câu hỏi của bạn:
TBKT-25140T có công suất bao nhiêu?
```

**Output:**
```
🔍 Searching...
💬 Generating answer...

✅ Answer:
Theo tài liệu TBKT 25140T-250kVA, công suất định mức là 250kVA...

📚 Sources:
   1. spec.xlsx, trang 1 (92.45%)
   2. manual.pdf, trang 5 (87.23%)
   3. technical_spec.pdf, trang 2 (85.67%)
```

### Cách 2: Qua Firebase Functions API

**Deploy functions:**
```bash
firebase deploy --only functions:ragChat
```

**Gọi API:**
```bash
curl -X POST \
  https://us-central1-YOUR_PROJECT.cloudfunctions.net/ragChat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "TBKT-25140T có công suất bao nhiêu?",
    "topK": 4
  }'
```

**Response:**
```json
{
  "answer": "Theo tài liệu TBKT 25140T-250kVA, công suất định mức là 250kVA...",
  "sources": [
    {
      "file_name": "spec.xlsx",
      "page_number": 1,
      "content_preview": "TBKT 25140T - 250kVA...",
      "similarity": 0.9245
    }
  ]
}
```

---

## 🔍 Ví Dụ Câu Hỏi

### 1. Tìm Thông Tin Cụ Thể
- "TBKT-25140T có công suất bao nhiêu?"
- "Thông số kỹ thuật của máy"
- "Hướng dẫn lắp đặt"
- "Giá bán là bao nhiêu?"

### 2. Tìm Trong File Cụ Thể
- "Trong file spec.xlsx có gì?"
- "Nội dung file manual.docx"
- "File technical_spec.pdf nói về gì?"

### 3. Tìm Kiếm Tổng Quát
- "Tóm tắt thông tin về sản phẩm"
- "Có những tính năng gì?"
- "Các bước vận hành"

### 4. So Sánh
- "So sánh 2 model khác nhau"
- "Khác biệt giữa version cũ và mới"

---

## 📊 Cách Hệ Thống Hoạt Động

1. **Ingest Phase:**
   - Đọc tất cả PDF trong folder
   - Chia nhỏ thành các đoạn văn (chunks)
   - Tạo vector embedding cho mỗi chunk (dùng Gemini AI)
   - Lưu vào SQL Server với vector search

2. **Chat Phase:**
   - Bạn hỏi câu hỏi
   - Hệ thống tạo vector embedding cho câu hỏi
   - Tìm các chunks tương tự nhất (semantic search)
   - Dùng Gemini AI để tổng hợp câu trả lời từ các chunks
   - Trả về câu trả lời kèm sources (file name, page number)

---

## ✅ Checklist

Trước khi chat:

- [ ] Đã ingest folder (chạy `ingest-folder.bat`)
- [ ] Ingest thành công (thấy "Total chunks: XXX")
- [ ] SQL Server đang chạy
- [ ] GEMINI_API_KEY đã set

---

## 🐛 Troubleshooting

### Lỗi: "Không tìm thấy thông tin trong tài liệu"

**Nguyên nhân:**
- Chưa ingest folder
- Câu hỏi không liên quan đến nội dung
- Folder không có file PDF

**Giải pháp:**
1. Chạy `ingest-folder.bat` trước
2. Kiểm tra folder có file PDF không
3. Thử câu hỏi khác

### Lỗi: "GEMINI_API_KEY not set"

**Giải pháp:**
```cmd
REM CMD
set GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

REM PowerShell
$env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```

### Lỗi: "SQL Server connection failed"

**Giải pháp:**
- Kiểm tra SQL Server đang chạy
- Set đúng SQL_SERVER_HOST, SQL_SERVER_DATABASE
- Kiểm tra user/password

---

## 📝 Lưu Ý

1. **Folder lớn:** Ingest có thể mất nhiều thời gian
2. **Recursive:** Script quét cả subfolders
3. **File Types:** Hỗ trợ PDF, Word (.docx), Excel (.xlsx), Text (.txt)
4. **Memory:** Folder rất lớn có thể tốn nhiều memory
5. **API Quota:** Mỗi chunk cần 1 API call để generate embedding

---

## 🎓 Tips

1. **Test với folder nhỏ trước** (< 10 files)
2. **Ingest một lần, chat nhiều lần** - Không cần ingest lại mỗi lần chat
3. **Câu hỏi cụ thể** sẽ cho kết quả tốt hơn
4. **Xem sources** để biết thông tin lấy từ file nào

---

## 📚 Files Liên Quan

- `ingest-folder.bat` - Ingest folder (standard)
- `ingest-folder-robust.bat` - Ingest folder (robust version) ⭐
- `chat-rag.bat` - Chat với RAG system ⭐
- `test-folder-ingest.js` - Test script
- `rag-service.js` - Core RAG logic

---

## 🎉 Kết Luận

Với hệ thống RAG này, bạn có thể:
- ✅ Ingest nhiều PDF vào hệ thống một lần
- ✅ Chat để tìm thông tin từ tất cả PDF
- ✅ Nhận câu trả lời kèm sources (file name, page number)
- ✅ Tìm kiếm semantic (hiểu nghĩa, không chỉ tìm từ khóa)

**Bắt đầu ngay:**
```cmd
ingest-folder-robust.bat
chat-rag.bat
```
