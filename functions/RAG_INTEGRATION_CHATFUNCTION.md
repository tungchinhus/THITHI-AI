# Tích hợp RAG vào ChatFunction

## ✅ Đã hoàn thành

Đã tích hợp RAG (Retrieval-Augmented Generation) vào `chatFunction` để ChatAI tự động tìm kiếm và sử dụng thông tin từ bảng `rag_documents` khi trả lời câu hỏi.

## 🔄 Cách hoạt động

### 1. Khi user gửi câu hỏi

1. **RAG Search** (TRƯỚC khi gọi Gemini):
   - Hệ thống tự động tìm kiếm trong `rag_documents` bằng vector similarity
   - Lấy top 4 chunks liên quan nhất với câu hỏi
   - Tạo context từ các chunks này

2. **Build Prompt**:
   - RAG context được thêm vào `combinedContext`
   - Prompt được build với RAG context + email context + OneDrive context + TSMay context

3. **Generate Answer**:
   - Gemini nhận được prompt đầy đủ với RAG context
   - Trả lời dựa trên thông tin từ RAG documents

4. **Response**:
   - Answer từ Gemini
   - Sources bao gồm RAG sources (file name, page number, content preview)

## 📝 Thay đổi code

### File: `functions/index.js`

#### 1. Khai báo biến `ragSources` ở scope cao hơn (dòng ~934)

```javascript
let combinedContext = '';
let ragSources = []; // RAG sources để thêm vào response sau
```

#### 2. Thêm RAG search vào phần build combinedContext (sau TSMay context, trước memory context)

```javascript
// Add RAG context (tài liệu từ rag_documents) to combined context
let ragContext = '';
if (ragService && sqlPoolInitialized && geminiApiKey) {
  try {
    console.log('🔍 Searching RAG documents for:', question.substring(0, 50));
    
    // Tìm kiếm các chunks liên quan (top 4)
    const ragResults = await ragService.searchSimilar(
      question,
      geminiApiKey,
      'rag_documents',
      4 // topK = 4 chunks
    );
    
    if (ragResults && ragResults.length > 0) {
      console.log(`✅ Found ${ragResults.length} relevant RAG chunks`);
      
      // Tạo context từ RAG results
      ragContext = ragResults.map((ctx, idx) => {
        return `[${ctx.fileName}, trang ${ctx.pageNumber}]: ${ctx.content}`;
      }).join('\n\n');
      
      // Tạo sources từ RAG results
      ragSources = ragResults.map(ctx => ({
        file: ctx.fileName,
        page: ctx.pageNumber,
        content: ctx.content.substring(0, 200) + (ctx.content.length > 200 ? '...' : ''),
        similarity: ctx.similarity
      }));
      
      // Thêm RAG context vào combinedContext
      combinedContext += `\n📚 THÔNG TIN TỪ TÀI LIỆU (RAG):\n${ragContext}\n\nKhi người dùng hỏi về nội dung trong tài liệu, hãy sử dụng thông tin ở trên để trả lời. Nếu không tìm thấy thông tin trong tài liệu, hãy nói rõ "Tôi không tìm thấy thông tin này trong tài liệu".\n\n`;
      
      console.log(`📚 RAG context added to prompt (${ragContext.length} chars, ${ragSources.length} sources)`);
    } else {
      console.log('ℹ️ No relevant RAG documents found');
    }
  } catch (ragError) {
    console.warn('⚠️ RAG search error:', ragError.message);
    // Không throw error, tiếp tục với context hiện tại
  }
}
```

#### 3. Thêm RAG sources vào response (sau khi có answer)

```javascript
// RAG Integration: Thêm RAG sources vào sources array
if (typeof ragSources !== 'undefined' && ragSources.length > 0) {
  sources = [...sources, ...ragSources];
  console.log(`✅ Added ${ragSources.length} RAG sources to response`);
}
```

## 🎯 Điều kiện để RAG hoạt động

RAG chỉ được kích hoạt khi:

1. ✅ `ragService` đã được load (từ `rag-service.js`)
2. ✅ `sqlPoolInitialized = true` (SQL Server đã được khởi tạo)
3. ✅ `geminiApiKey` có sẵn (để generate embedding cho query)

Nếu thiếu bất kỳ điều kiện nào, hệ thống sẽ:
- Log warning nhưng không throw error
- Tiếp tục hoạt động bình thường (không có RAG context)
- Chat vẫn hoạt động với các context khác (email, OneDrive, TSMay)

## 📊 Ví dụ

### Câu hỏi: "Lộ trình Chuyển đổi số đã đồng bộ cùng với danh sách các sáng kiến đề xuất dựa trên các chương trình hành động của THIBIDI đoạn trên nằm ở file nào nhỉ"

**Trước khi tích hợp RAG:**
```
Tôi không có đủ thông tin để trả lời câu hỏi này...
```

**Sau khi tích hợp RAG:**
1. RAG search tìm thấy chunks liên quan trong `rag_documents`
2. Context được thêm vào prompt: `📚 THÔNG TIN TỪ TÀI LIỆU (RAG): [file.pdf, trang 5]: Lộ trình Chuyển đổi số đã đồng bộ...`
3. Gemini trả lời: "Theo tài liệu, đoạn này nằm trong file [tên file], trang [số trang]..."
4. Sources bao gồm: `[{file: "file.pdf", page: 5, content: "...", similarity: 0.92}]`

## 🧪 Cách test

### 1. Đảm bảo RAG data đã được ingest

```bash
# Chạy ingest folder để có data trong rag_documents
cd functions
node test-folder-ingest.js
```

Hoặc gọi endpoint:
```bash
curl -X POST "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/ragIngestFolder" \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "C:\\MyData\\P-TK\\TBKT-25140T-250kV"}'
```

### 2. Test chat với câu hỏi về tài liệu

```bash
curl -X POST "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/chatFunction" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Lộ trình Chuyển đổi số đã đồng bộ cùng với danh sách các sáng kiến đề xuất dựa trên các chương trình hành động của THIBIDI đoạn trên nằm ở file nào nhỉ"
  }'
```

### 3. Kiểm tra logs

```bash
firebase functions:log --only chatFunction
```

Tìm các log:
- `🔍 Searching RAG documents for: ...`
- `✅ Found X relevant RAG chunks`
- `📚 RAG context added to prompt`
- `✅ Added X RAG sources to response`

## 🐛 Troubleshooting

### Vấn đề: RAG không hoạt động

**Kiểm tra:**
1. `ragService` có được load không?
   ```javascript
   // Trong index.js, kiểm tra:
   console.log('RAG service:', ragService ? 'loaded' : 'not loaded');
   ```

2. SQL Server có được khởi tạo không?
   ```javascript
   console.log('SQL Pool:', sqlPoolInitialized ? 'initialized' : 'not initialized');
   ```

3. Gemini API key có sẵn không?
   ```javascript
   console.log('Gemini API Key:', geminiApiKey ? 'available' : 'missing');
   ```

### Vấn đề: Không tìm thấy RAG documents

**Nguyên nhân:**
- Chưa ingest data vào `rag_documents`
- Câu hỏi không match với content trong database
- Embedding dimension không khớp

**Giải pháp:**
1. Kiểm tra data trong database:
   ```sql
   SELECT COUNT(*) FROM rag_documents WHERE Embedding IS NOT NULL;
   ```

2. Ingest lại data:
   ```bash
   node test-folder-ingest.js
   ```

3. Kiểm tra embedding dimension:
   ```sql
   SELECT COL_LENGTH('dbo.[rag_documents]', 'Embedding') AS EmbeddingDimension;
   ```
   Phải là 768 (Gemini text-embedding-004) hoặc 384 (ONNX models)

### Vấn đề: RAG search quá chậm

**Giải pháp:**
1. Tạo vector index:
   ```sql
   CREATE VECTOR INDEX IX_rag_documents_Embedding 
   ON dbo.[rag_documents] (Embedding) 
   WITH (INDEX_TYPE = HNSW, DISTANCE_FUNCTION = COSINE);
   ```

2. Giảm topK (từ 4 xuống 2-3) nếu cần

## 📈 Tối ưu hóa

### 1. Tăng độ chính xác

- Tăng `topK` từ 4 lên 6-8 để có nhiều context hơn
- Giảm `chunk_size` khi ingest để chia nhỏ hơn

### 2. Tăng tốc độ

- Tạo vector index (HNSW)
- Cache embedding của câu hỏi thường gặp
- Giảm `topK` nếu không cần nhiều context

### 3. Filter theo metadata

Có thể thêm filter để chỉ tìm trong một số files cụ thể:
```javascript
// Trong rag-service.js, thêm parameter fileFilter
const ragResults = await ragService.searchSimilar(
  question,
  geminiApiKey,
  'rag_documents',
  4,
  fileFilter: ['file1.pdf', 'file2.pdf'] // Optional
);
```

## ✅ Kết quả

Sau khi tích hợp RAG:

- ✅ ChatAI tự động tìm kiếm trong `rag_documents`
- ✅ Trả lời dựa trên thông tin từ tài liệu đã ingest
- ✅ Có sources để trace lại nguồn gốc
- ✅ Không cần gọi endpoint riêng `/ragChat`
- ✅ Tích hợp seamless với các context khác (email, OneDrive, TSMay)

## 📝 Lưu ý

- RAG search được thực hiện **TRƯỚC** khi gọi Gemini, không phải sau
- RAG context được thêm vào prompt, không phải thay thế answer
- Nếu RAG search fail, hệ thống vẫn hoạt động bình thường (graceful degradation)
- RAG sources được thêm vào `sources` array để frontend có thể hiển thị
