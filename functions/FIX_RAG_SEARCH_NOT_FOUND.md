# Hướng dẫn: Fix RAG Search không tìm thấy thông tin từ PDF đã vector hóa

## 🔍 Vấn đề

Bạn đã vector hóa PDF nhưng khi hỏi về nội dung trong PDF (ví dụ: "Các sáng kiến cải thiện hiệu suất quản trị và SXKD"), hệ thống không tìm thấy thông tin.

## ✅ Đã cải thiện

1. **Giảm similarity threshold từ 0.25 xuống 0.2** - Lấy nhiều kết quả hơn cho các query tiếng Việt
2. **Tạo script test cụ thể** - `test-specific-query.js` để test query về "sáng kiến cải thiện hiệu suất"

## 🧪 Cách kiểm tra và debug

### Bước 1: Test query cụ thể

```bash
cd functions
node test-specific-query.js
```

Script này sẽ:
- ✅ Test nhiều biến thể của query "Các sáng kiến cải thiện hiệu suất quản trị và SXKD"
- ✅ Hiển thị similarity scores chi tiết
- ✅ Kiểm tra xem có records trong database chứa keywords không
- ✅ Phân tích distribution của similarity scores

### Bước 2: Kiểm tra database

```sql
-- Kiểm tra số lượng records
SELECT COUNT(*) AS TotalRecords FROM rag_documents;

-- Kiểm tra records có embedding
SELECT COUNT(*) AS WithEmbedding 
FROM rag_documents 
WHERE Embedding IS NOT NULL;

-- Tìm records chứa keywords liên quan
SELECT TOP 10
    ID,
    FileName,
    PageNumber,
    LEFT(Content, 200) AS ContentPreview,
    CASE WHEN Embedding IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasEmbedding
FROM rag_documents
WHERE Content LIKE '%sáng kiến%' 
   OR Content LIKE '%quản trị%'
   OR Content LIKE '%SXKD%'
   OR Content LIKE '%hiệu suất%'
ORDER BY CreatedAt DESC;
```

### Bước 3: Kiểm tra logs trong Firebase Functions

Khi chat, tìm các log sau trong Firebase Functions logs:

```
🔍 RAG Search Check: {
  ragService: '✅ loaded',
  sqlPool: '✅ initialized',
  apiKey: '✅ available'
}

📊 RAG search returned X results
📊 Similarity scores: min=X, max=X, avg=X
📊 Filtered results (similarity >= 0.2): X/Y
```

## 🐛 Các nguyên nhân thường gặp

### 1. Similarity threshold quá cao

**Triệu chứng:** Có results nhưng không có results nào trên threshold

**Giải pháp:** 
- Đã giảm từ 0.25 xuống 0.2
- Nếu vẫn không đủ, có thể giảm xuống 0.15 (nhưng sẽ có nhiều noise hơn)

### 2. Query không match với content trong database

**Triệu chứng:** Similarity scores thấp (< 0.2)

**Giải pháp:**
- Thử các biến thể khác nhau của query
- Ví dụ: "sáng kiến" thay vì "Các sáng kiến cải thiện..."
- Hoặc: "quản trị và sản xuất" thay vì "SXKD"

### 3. Embedding dimension không khớp

**Triệu chứng:** Lỗi khi query VECTOR_DISTANCE

**Kiểm tra:**
```sql
SELECT COL_LENGTH('dbo.[rag_documents]', 'Embedding') AS EmbeddingDimension;
```

Phải là **768** (Gemini text-embedding-004) hoặc **384** (ONNX)

### 4. Không có data trong rag_documents

**Triệu chứng:** "Table is empty" hoặc "No records with embeddings"

**Giải pháp:**
```bash
# Re-ingest PDF files
cd functions
node test-folder-ingest.js
```

Hoặc gọi endpoint:
```bash
curl -X POST "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/ragIngestFolder" \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "C:\\MyData\\P-TK\\TBKT-25140T-250kVA"}'
```

### 5. Content trong PDF không được extract đúng

**Triệu chứng:** Records có nhưng Content rỗng hoặc không đầy đủ

**Kiểm tra:**
```sql
SELECT TOP 10
    FileName,
    PageNumber,
    LEN(Content) AS ContentLength,
    LEFT(Content, 200) AS ContentPreview
FROM rag_documents
WHERE FileName LIKE '%THIBIDI%'
ORDER BY CreatedAt DESC;
```

Nếu Content rỗng hoặc quá ngắn, có thể PDF có vấn đề về format hoặc OCR cần thiết.

## 🔧 Tối ưu thêm (nếu cần)

### 1. Tăng topK trong search

Trong `functions/index.js`, dòng 1042:
```javascript
const ragResults = await ragService.searchSimilar(
  question,
  geminiApiKey,
  'rag_documents',
  12 // Tăng từ 8 lên 12
);
```

### 2. Giảm similarity threshold hơn nữa

Trong `functions/index.js`, dòng 1058:
```javascript
const SIMILARITY_THRESHOLD = 0.15; // Giảm từ 0.2 xuống 0.15
```

⚠️ **Lưu ý:** Giảm threshold sẽ lấy nhiều kết quả hơn nhưng có thể có nhiều noise.

### 3. Cải thiện query expansion

Có thể thêm query expansion để tìm nhiều biến thể hơn:
```javascript
// Trong functions/index.js, trước khi gọi searchSimilar
const expandedQuery = expandQuery(question);
// expandQuery có thể thêm synonyms, related terms, etc.
```

## 📊 Monitoring

Để theo dõi hiệu quả của RAG search:

1. **Log similarity scores** - Xem distribution của scores
2. **Track query success rate** - Tỷ lệ queries có results trên threshold
3. **Monitor false positives** - Kết quả không liên quan nhưng có similarity cao

## ✅ Checklist

- [ ] Đã chạy `test-specific-query.js` và xem kết quả
- [ ] Đã kiểm tra database có data không
- [ ] Đã kiểm tra embedding dimension đúng chưa
- [ ] Đã xem logs trong Firebase Functions
- [ ] Đã thử các biến thể query khác nhau
- [ ] Đã kiểm tra Content trong database có đầy đủ không

## 🔗 Tài liệu liên quan

- `RAG_SEARCH_DEBUG_OPTIMIZE.md` - Debug và tối ưu RAG search chi tiết
- `test-rag-search-debug.js` - Script test tổng quát
- `test-specific-query.js` - Script test query cụ thể (mới tạo)
- `HUONG_DAN_RAG_CHATAI.md` - Hướng dẫn RAG tổng quan
