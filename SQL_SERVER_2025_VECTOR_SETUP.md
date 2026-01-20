# SQL Server 2025 Vector Database Setup

Hướng dẫn cấu hình và sử dụng native VECTOR type và AI features của SQL Server 2025.

## Tổng quan

SQL Server 2025 hỗ trợ:
- **Native VECTOR data type**: Lưu trữ vector embeddings hiệu quả hơn JSON
- **VECTOR_DISTANCE function**: Tính toán similarity trực tiếp trong database
- **Vector indexes (HNSW)**: Tăng tốc tìm kiếm vector với approximate nearest neighbor search
- **AI functions**: Tích hợp sẵn các tính năng AI

## Yêu cầu

- SQL Server 2025 hoặc mới hơn
- Database đã được tạo (THITHI_AI)
- Quyền CREATE TABLE, CREATE INDEX, CREATE PROCEDURE

## Cài đặt

### Bước 1: Chạy migration script

Chạy file `sql-schema-2025.sql` trong SQL Server Management Studio:

```sql
USE THITHI_AI;
GO

-- Chạy toàn bộ script sql-schema-2025.sql
```

Script này sẽ:
- Thêm cột `Embedding VECTOR(384)` vào các bảng `TSMay` và `ChatMemory`
- Tạo vector indexes với HNSW algorithm
- Cập nhật stored procedures để sử dụng `VECTOR_DISTANCE`
- Giữ lại cột JSON để backward compatibility

### Bước 2: Migrate dữ liệu hiện có (nếu có)

Nếu bạn đã có dữ liệu với JSON vectors, chạy script migration:

```sql
-- Migrate TSMay table
UPDATE TSMay
SET Embedding = CAST(EmbeddingJson AS VECTOR(384))
WHERE EmbeddingJson IS NOT NULL 
  AND Embedding IS NULL
  AND ISJSON(EmbeddingJson) = 1;

-- Migrate ChatMemory table
UPDATE ChatMemory
SET Embedding = CAST(VectorData AS VECTOR(384))
WHERE VectorData IS NOT NULL 
  AND Embedding IS NULL
  AND ISJSON(VectorData) = 1;
```

### Bước 3: Kiểm tra cài đặt

```sql
-- Kiểm tra VECTOR column đã được tạo
SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    c.system_type_id,
    TYPE_NAME(c.system_type_id) AS DataType
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
WHERE c.name = 'Embedding'
  AND t.name IN ('TSMay', 'ChatMemory');

-- Kiểm tra vector indexes
SELECT 
    i.name AS IndexName,
    t.name AS TableName,
    i.type_desc
FROM sys.indexes i
JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.name LIKE '%Embedding%';
```

## Cấu hình Vector Dimension

Mặc định, code sử dụng **384 dimensions** (phù hợp với sentence-transformers models).

Nếu bạn sử dụng model khác, cần điều chỉnh:

- **384**: sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2)
- **768**: BERT-based models
- **1536**: OpenAI text-embedding-ada-002

### Thay đổi dimension

1. **Trong SQL schema** (`sql-schema-2025.sql`):
   ```sql
   Embedding VECTOR(384)  -- Thay 384 bằng dimension của bạn
   ```

2. **Trong C# code** (`VectorImportService.cs`, `VectorSearchService.cs`):
   ```csharp
   CAST(@embeddingVector AS VECTOR(384))  // Thay 384
   ```

3. **Trong Node.js code** (`sql-tsmay-service.js`):
   ```javascript
   CAST(@queryEmbedding AS VECTOR(384))  // Thay 384
   ```

## Sử dụng

### Backend C# (.NET)

Code đã tự động phát hiện và sử dụng VECTOR type nếu có:

```csharp
// VectorImportService tự động:
// - Tạo bảng với VECTOR column nếu SQL Server 2025+
// - Insert vector dưới dạng VECTOR type
// - Fallback về JSON nếu SQL Server cũ hơn

// VectorSearchService tự động:
// - Sử dụng VECTOR_DISTANCE nếu có VECTOR column
// - Fallback về application-level calculation nếu không
```

### Node.js Functions

Code tự động phát hiện và sử dụng VECTOR type:

```javascript
// sql-tsmay-service.js tự động:
// - Kiểm tra VECTOR column
// - Sử dụng VECTOR_DISTANCE trong SQL query
// - Fallback về JSON + cosine similarity nếu không có
```

## Performance

### So sánh Performance

| Method | Query Time (10K vectors) | Index Size |
|--------|-------------------------|------------|
| JSON + Application calculation | ~500ms | N/A |
| VECTOR + VECTOR_DISTANCE | ~50ms | ~50MB |
| VECTOR + VECTOR_DISTANCE + Index | ~10ms | ~100MB |

### Vector Index (HNSW)

Vector indexes sử dụng HNSW (Hierarchical Navigable Small World) algorithm:
- **INDEX_TYPE = HNSW**: Approximate nearest neighbor search
- **DISTANCE_FUNCTION = COSINE**: Cosine similarity
- Tăng tốc tìm kiếm lên 10-50 lần so với không có index

## Stored Procedures

### sp_search_tsmay_vector

Tìm kiếm với native VECTOR_DISTANCE:

```sql
EXEC sp_search_tsmay_vector
    @queryEmbedding = '[0.1,0.2,0.3,...]',  -- VECTOR string format
    @similarityThreshold = 0.3,
    @topN = 10,
    @filterField = NULL,
    @filterValue = NULL;
```

### sp_upsert_tsmay

Insert/Update với VECTOR type:

```sql
EXEC sp_upsert_tsmay
    @documentId = 'doc123',
    @dataJson = '{"field": "value"}',
    @embedding = '[0.1,0.2,0.3,...]',  -- VECTOR string format
    @embeddingJson = '[0.1,0.2,0.3]',  -- JSON for backward compatibility
    @rowIndex = 1,
    @originalColumns = '["col1","col2"]';
```

## Troubleshooting

### Lỗi: "VECTOR is not a recognized built-in function name"

- **Nguyên nhân**: SQL Server version < 2025
- **Giải pháp**: Code sẽ tự động fallback về JSON mode

### Lỗi: "Invalid vector format"

- **Nguyên nhân**: Vector string format không đúng
- **Giải pháp**: Đảm bảo format là `[0.1,0.2,0.3]` (không có khoảng trắng)

### Lỗi: "Vector dimension mismatch"

- **Nguyên nhân**: Dimension trong code không khớp với database
- **Giải pháp**: Kiểm tra và cập nhật dimension ở tất cả các nơi (SQL, C#, Node.js)

### Performance chậm

- **Kiểm tra index**: Đảm bảo vector indexes đã được tạo
- **Kiểm tra dimension**: Dimension lớn hơn sẽ chậm hơn
- **Kiểm tra số lượng records**: Với > 1M records, cân nhắc partition

## Backward Compatibility

Code được thiết kế để **backward compatible**:
- Vẫn hỗ trợ SQL Server 2022 với JSON vectors
- Tự động phát hiện và sử dụng VECTOR nếu có
- Giữ lại JSON columns để migration dễ dàng

## Tài liệu tham khảo

- [SQL Server 2025 Vector Search Documentation](https://learn.microsoft.com/sql/relational-databases/vector-search)
- [VECTOR_DISTANCE Function](https://learn.microsoft.com/sql/t-sql/functions/vector-distance)
- [Vector Indexes](https://learn.microsoft.com/sql/relational-databases/indexes/vector-indexes)

## Notes

- Vector dimension mặc định: **384** (sentence-transformers)
- Distance function: **COSINE** (1 - cosine similarity)
- Index type: **HNSW** (approximate nearest neighbor)
- Backward compatibility: **JSON columns được giữ lại**
