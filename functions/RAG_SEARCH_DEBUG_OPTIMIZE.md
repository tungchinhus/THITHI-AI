# Debug và Tối ưu RAG Search

## 🔍 Vấn đề: ChatAI không tìm được thông tin từ rag_documents

### Đã tối ưu

1. ✅ **Tăng topK từ 4 lên 8** - Lấy nhiều kết quả hơn để có context đầy đủ
2. ✅ **Giảm similarity threshold từ 0.3 xuống 0.25** - Lấy nhiều kết quả hơn
3. ✅ **Thêm logging chi tiết** - Dễ debug hơn
4. ✅ **Kiểm tra điều kiện trước khi search** - Tránh lỗi không cần thiết
5. ✅ **Cải thiện error handling** - Log đầy đủ thông tin lỗi

## 🧪 Cách test và debug

### Bước 1: Test RAG search trực tiếp

```bash
cd functions
node test-rag-search-debug.js
```

Script này sẽ:
- ✅ Kiểm tra SQL Server connection
- ✅ Kiểm tra table `rag_documents` có data không
- ✅ Kiểm tra API key
- ✅ Test search với các query mẫu
- ✅ Hiển thị similarity scores

### Bước 2: Kiểm tra logs trong Firebase Functions

```bash
firebase functions:log --only chatFunction --limit 50
```

Tìm các log:
- `🔍 RAG Search Check:` - Kiểm tra điều kiện
- `🔍 [RAG] Starting searchSimilar` - Bắt đầu search
- `📊 [RAG] Table exists with X total records` - Số lượng records
- `📊 [RAG] Similarity scores:` - Điểm similarity
- `✅ RAG context added to prompt` - Context đã được thêm

### Bước 3: Kiểm tra database trực tiếp

```sql
-- Kiểm tra số lượng records
SELECT COUNT(*) AS TotalRecords FROM rag_documents;

-- Kiểm tra records có embedding
SELECT COUNT(*) AS WithEmbedding 
FROM rag_documents 
WHERE Embedding IS NOT NULL;

-- Kiểm tra records có VectorJson
SELECT COUNT(*) AS WithVectorJson 
FROM rag_documents 
WHERE VectorJson IS NOT NULL;

-- Xem một vài records mẫu
SELECT TOP 5 
    ID, 
    FileName, 
    PageNumber, 
    LEFT(Content, 100) AS ContentPreview,
    CASE WHEN Embedding IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasEmbedding,
    CASE WHEN VectorJson IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasVectorJson
FROM rag_documents
ORDER BY CreatedAt DESC;
```

## 🐛 Troubleshooting

### Vấn đề 1: "Table rag_documents does not exist"

**Nguyên nhân:** Chưa ingest data

**Giải pháp:**
```bash
cd functions
node test-folder-ingest.js
```

Hoặc gọi endpoint:
```bash
curl -X POST "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/ragIngestFolder" \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "C:\\MyData\\P-TK\\TBKT-25140T-250kV"}'
```

### Vấn đề 2: "No records with embeddings found"

**Nguyên nhân:** Data đã được ingest nhưng không có embeddings

**Giải pháp:**
1. Kiểm tra embedding dimension:
   ```sql
   SELECT COL_LENGTH('dbo.[rag_documents]', 'Embedding') AS EmbeddingDimension;
   ```
   Phải là 768 (Gemini text-embedding-004) hoặc 384 (ONNX)

2. Re-ingest với đúng embedding model:
   ```bash
   # Đảm bảo GEMINI_API_KEY đã được set
   firebase functions:secrets:access GEMINI_API_KEY
   
   # Re-ingest
   node test-folder-ingest.js
   ```

### Vấn đề 3: "RAG search returned empty results"

**Nguyên nhân có thể:**
- Query embedding không match với document embeddings
- Similarity threshold quá cao
- Data không liên quan đến query

**Giải pháp:**
1. Kiểm tra similarity scores trong logs
2. Giảm threshold nếu cần (đã giảm từ 0.3 xuống 0.25)
3. Thử query khác hoặc từ khóa cụ thể hơn

### Vấn đề 4: "RAG service not loaded"

**Nguyên nhân:** `rag-service.js` không được load

**Giải pháp:**
1. Kiểm tra file `rag-service.js` có tồn tại không
2. Kiểm tra exports trong `rag-service.js`:
   ```javascript
   module.exports = {
     searchSimilar,
     // ...
   };
   ```
3. Kiểm tra require trong `index.js`:
   ```javascript
   ragService = require('./rag-service');
   ```

### Vấn đề 5: "SQL pool not initialized"

**Nguyên nhân:** SQL Server connection chưa được setup

**Giải pháp:**
1. Kiểm tra secrets:
   ```bash
   firebase functions:secrets:access SQL_SERVER_HOST
   firebase functions:secrets:access SQL_SERVER_DATABASE
   ```

2. Kiểm tra connection trong code:
   ```javascript
   // Trong index.js, kiểm tra:
   console.log('SQL Pool:', sqlPoolInitialized ? 'initialized' : 'not initialized');
   ```

### Vấn đề 6: Similarity scores quá thấp (< 0.25)

**Nguyên nhân:** Query không match với documents

**Giải pháp:**
1. Thử query với từ khóa cụ thể hơn
2. Kiểm tra xem documents có chứa từ khóa không:
   ```sql
   SELECT FileName, PageNumber, Content
   FROM rag_documents
   WHERE Content LIKE '%chuyển đổi số%'
   OR Content LIKE '%THIBIDI%'
   ```

3. Nếu không có, cần ingest documents mới

## ⚙️ Tối ưu hóa thêm

### 1. Tăng độ chính xác

**Tăng topK:**
```javascript
// Trong index.js, dòng ~1025
const ragResults = await ragService.searchSimilar(
  question,
  geminiApiKey,
  'rag_documents',
  10 // Tăng từ 8 lên 10
);
```

**Giảm similarity threshold:**
```javascript
// Trong index.js, dòng ~1040
const SIMILARITY_THRESHOLD = 0.2; // Giảm từ 0.25 xuống 0.2
```

### 2. Tăng tốc độ

**Tạo vector index:**
```sql
-- Kiểm tra index đã tồn tại chưa
SELECT name, type_desc 
FROM sys.indexes 
WHERE object_id = OBJECT_ID('dbo.[rag_documents]')
AND name = 'IX_rag_documents_Embedding';

-- Tạo index nếu chưa có
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes 
  WHERE object_id = OBJECT_ID('dbo.[rag_documents]')
  AND name = 'IX_rag_documents_Embedding'
)
BEGIN
  CREATE VECTOR INDEX IX_rag_documents_Embedding 
  ON dbo.[rag_documents] (Embedding) 
  WITH (INDEX_TYPE = HNSW, DISTANCE_FUNCTION = COSINE);
  
  PRINT 'Vector index created successfully';
END
ELSE
BEGIN
  PRINT 'Vector index already exists';
END
```

**Giảm topK nếu không cần nhiều context:**
```javascript
const ragResults = await ragService.searchSimilar(
  question,
  geminiApiKey,
  'rag_documents',
  4 // Giảm từ 8 xuống 4 để nhanh hơn
);
```

### 3. Cải thiện prompt

**Thêm instruction rõ ràng hơn trong prompt:**
```javascript
// Trong index.js, dòng ~1049
combinedContext += `\n📚 THÔNG TIN TỪ TÀI LIỆU PDF ĐÃ ĐƯỢC LƯU TRỮ (RAG):\n${ragContext}\n\n**QUAN TRỌNG:** Khi người dùng hỏi về nội dung trong tài liệu PDF, bạn PHẢI sử dụng thông tin ở trên để trả lời. Nếu người dùng hỏi "đoạn này nằm ở đâu" hoặc "file nào", hãy trả lời dựa trên thông tin FileName và PageNumber ở trên. Nếu không tìm thấy thông tin trong tài liệu, hãy nói rõ "Tôi không tìm thấy thông tin này trong tài liệu đã được lưu trữ".\n\n`;
```

## 📊 Monitoring

### Logs quan trọng cần theo dõi

1. **RAG Search Check:**
   ```
   🔍 RAG Search Check: {
     ragService: '✅ loaded' | '❌ not loaded',
     sqlPool: '✅ initialized' | '❌ not initialized',
     apiKey: '✅ available' | '❌ missing'
   }
   ```

2. **Search Results:**
   ```
   ✅ Found X relevant RAG chunks (similarity >= 0.25)
   📊 Similarity scores: min=X, max=X, avg=X
   ```

3. **Context Added:**
   ```
   ✅ RAG context added to prompt (X chars, Y sources)
   ```

### Metrics cần track

- Số lượng queries có RAG results
- Average similarity score
- Số lượng sources được thêm vào response
- Thời gian search (nếu cần optimize)

## ✅ Checklist

Trước khi deploy, đảm bảo:

- [ ] SQL Server connection đã được setup
- [ ] Table `rag_documents` có data
- [ ] Records có embeddings (Embedding hoặc VectorJson)
- [ ] GEMINI_API_KEY đã được set
- [ ] `rag-service.js` được load đúng cách
- [ ] Test script chạy thành công
- [ ] Logs hiển thị đầy đủ thông tin

## 🚀 Deploy

Sau khi test và optimize:

```bash
# Deploy function
firebase deploy --only functions:chatFunction

# Kiểm tra logs sau khi deploy
firebase functions:log --only chatFunction --limit 20
```

## 📝 Notes

- Similarity threshold 0.25 là balance giữa độ chính xác và số lượng kết quả
- TopK = 8 là đủ để có context đầy đủ nhưng không quá nhiều
- Vector index sẽ tăng tốc độ search đáng kể (10-100x)
- Logging chi tiết giúp debug nhanh hơn nhưng có thể làm chậm một chút
