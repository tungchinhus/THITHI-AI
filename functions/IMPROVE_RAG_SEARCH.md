# Cải thiện RAG Search với data đã có sẵn trong DB

## ✅ Các cải thiện đã thực hiện

### 1. Giảm Similarity Threshold
- **File:** `functions/index.js`
- **Thay đổi:** Giảm từ 0.25 xuống **0.2**
- **Lý do:** Tăng khả năng tìm thấy kết quả cho các query tiếng Việt
- **Dòng:** 1058

### 2. Thêm Query Normalization
- **File:** `functions/rag-service.js`
- **Thay đổi:** Thêm hàm `normalizeQuery()` để normalize query trước khi generate embedding
- **Chức năng:**
  - Loại bỏ khoảng trắng thừa
  - Loại bỏ dấu câu không cần thiết ở đầu/cuối
  - Đảm bảo query có format tốt cho embedding
- **Dòng:** 27-50

### 3. Tạo Script Test Chi Tiết
- **File:** `functions/test-rag-with-existing-data.js`
- **Chức năng:**
  - Kiểm tra data trong DB
  - Test search với query cụ thể
  - Phân tích similarity scores
  - Test với nhiều query variations

## 🧪 Cách test

### Bước 1: Test với script chi tiết

```bash
cd functions
node test-rag-with-existing-data.js
```

Script này sẽ:
1. ✅ Kiểm tra data trong DB (số lượng records, embeddings, content)
2. ✅ Tìm records chứa keywords liên quan
3. ✅ Test RAG search với query cụ thể
4. ✅ Phân tích similarity distribution
5. ✅ Test với nhiều query variations

### Bước 2: Test trong ứng dụng

1. Mở ứng dụng chat
2. Hỏi: "Các sáng kiến cải thiện hiệu suất quản trị và SXKD"
3. Kiểm tra logs trong Firebase Functions để xem:
   - Similarity scores
   - Số lượng results
   - Results có trên threshold không

### Bước 3: Kiểm tra logs

Trong Firebase Functions logs, tìm:
```
🔍 [RAG] Starting searchSimilar:
  originalQuery: "..."
  normalizedQuery: "..."
  
📊 [RAG] Similarity scores: ...
📊 Filtered results (similarity >= 0.2): X/Y
```

## 🔍 Debug nếu vẫn không tìm thấy

### 1. Kiểm tra Similarity Scores

Nếu similarity scores quá thấp (< 0.2):
- **Nguyên nhân:** Query không match với content trong DB
- **Giải pháp:**
  - Thử các biến thể query khác
  - Kiểm tra xem content trong DB có chứa keywords không
  - Có thể cần re-ingest với chunk size nhỏ hơn

### 2. Kiểm tra Content trong DB

```sql
-- Tìm records chứa keywords
SELECT TOP 10
    ID,
    FileName,
    PageNumber,
    LEFT(Content, 200) AS ContentPreview
FROM rag_documents
WHERE Content LIKE '%sáng kiến%' 
   OR Content LIKE '%quản trị%'
   OR Content LIKE '%SXKD%'
ORDER BY CreatedAt DESC;
```

Nếu không tìm thấy records:
- Content có thể không được extract đúng từ PDF
- Cần kiểm tra lại quá trình ingest

### 3. Kiểm tra Embedding Dimension

```sql
SELECT COL_LENGTH('dbo.[rag_documents]', 'Embedding') AS EmbeddingDimension;
```

Phải là **768** (Gemini text-embedding-004)

### 4. Test với Query Variations

Thử các query khác nhau:
- "sáng kiến cải thiện hiệu suất"
- "quản trị và SXKD"
- "sáng kiến số"
- "cải thiện hiệu suất quản trị"

Xem query nào có similarity cao hơn.

## 🔧 Tối ưu thêm (nếu cần)

### 1. Giảm Threshold hơn nữa

Trong `functions/index.js`, dòng 1058:
```javascript
const SIMILARITY_THRESHOLD = 0.15; // Giảm từ 0.2 xuống 0.15
```

⚠️ **Lưu ý:** Giảm threshold sẽ lấy nhiều kết quả hơn nhưng có thể có noise.

### 2. Tăng topK

Trong `functions/index.js`, dòng 1042:
```javascript
const ragResults = await ragService.searchSimilar(
  question,
  geminiApiKey,
  'rag_documents',
  12 // Tăng từ 8 lên 12
);
```

### 3. Cải thiện Query Normalization

Có thể thêm vào `normalizeQuery()`:
- Expand abbreviations (SXKD → sản xuất kinh doanh)
- Add synonyms
- Remove stop words (nếu cần)

## 📊 Monitoring

Để theo dõi hiệu quả:

1. **Track similarity scores** - Xem distribution
2. **Monitor query success rate** - Tỷ lệ queries có results
3. **Log query variations** - Xem query nào hoạt động tốt

## ✅ Checklist

- [x] Giảm similarity threshold từ 0.25 xuống 0.2
- [x] Thêm query normalization
- [x] Tạo script test chi tiết
- [ ] Chạy test script và xem kết quả
- [ ] Kiểm tra logs trong Firebase Functions
- [ ] Test trong ứng dụng chat
- [ ] Điều chỉnh threshold nếu cần

## 🔗 Files liên quan

- `functions/index.js` - Chat function với RAG integration
- `functions/rag-service.js` - RAG service với searchSimilar
- `functions/test-rag-with-existing-data.js` - Script test chi tiết
- `functions/FIX_RAG_SEARCH_NOT_FOUND.md` - Hướng dẫn debug tổng quát
