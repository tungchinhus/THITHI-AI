# Hướng Dẫn Tích Hợp SQL Server với Vector Embeddings

## Tổng Quan

Giải pháp này tích hợp SQL Server 2022+ với vector embeddings để cải thiện khả năng tìm kiếm semantic cho dữ liệu TSMay.

**Lưu ý:** SQL Server 2022 chưa hỗ trợ native vector type. Giải pháp này sử dụng:
- JSON để lưu trữ vector embeddings (compatible với SQL Server 2022)
- Gemini API để generate embeddings
- Cosine similarity được tính toán trong Node.js

**SQL Server 2025+:** Khi upgrade lên SQL Server 2025, có thể sử dụng native `VECTOR` type và `VECTOR_DISTANCE` function.

## Kiến Trúc

```
┌─────────────┐
│   Angular   │
│   Frontend  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Firebase        │
│ Functions       │
│ (Node.js)       │
└──────┬──────────┘
       │
       ├──────────────┐
       ▼              ▼
┌─────────────┐  ┌──────────────┐
│  Firestore  │  │ SQL Server  │
│  (Backup)   │  │ (Primary)   │
└─────────────┘  └──────┬───────┘
                        │
                        ▼
                  ┌─────────────┐
                  │  Vector     │
                  │  Embeddings │
                  │  (JSON)     │
                  └─────────────┘
```

## Cài Đặt

### Bước 1: Cài đặt SQL Server Driver

```bash
cd functions
npm install mssql
```

### Bước 2: Tạo Database và Schema

1. **Kết nối SQL Server:**
   ```sql
   -- Tạo database
   CREATE DATABASE THITHI_AI;
   GO
   USE THITHI_AI;
   GO
   ```

2. **Chạy SQL Schema:**
   ```bash
   # Copy file sql-schema.sql vào SQL Server Management Studio và execute
   # Hoặc sử dụng sqlcmd:
   sqlcmd -S localhost -U sa -P YourPassword -d THITHI_AI -i functions/sql-schema.sql
   ```

### Bước 3: Cấu Hình Environment Variables

Thêm vào Firebase Secrets:

```bash
# SQL Server Configuration
firebase functions:secrets:set SQL_SERVER_HOST
# Nhập: your-sql-server.database.windows.net (Azure SQL) hoặc localhost

firebase functions:secrets:set SQL_SERVER_USER
# Nhập: your-username

firebase functions:secrets:set SQL_SERVER_PASSWORD
# Nhập: your-password

firebase functions:secrets:set SQL_SERVER_DATABASE
# Nhập: THITHI_AI

firebase functions:secrets:set SQL_SERVER_PORT
# Nhập: 1433 (default) hoặc port của bạn

firebase functions:secrets:set SQL_SERVER_ENCRYPT
# Nhập: true (Azure SQL) hoặc false (local SQL Server)
```

### Bước 4: Deploy Functions

```bash
firebase deploy --only functions
```

## Sử Dụng

### 1. Khởi Tạo SQL Server Connection

```bash
curl -X POST https://YOUR_FUNCTION_URL/initializeSQLServer
```

### 2. Migrate Data từ Firestore sang SQL Server

```bash
curl -X POST https://YOUR_FUNCTION_URL/migrateTSMayToSQL \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}'
```

### 3. Search với Vector Similarity

```bash
curl -X POST https://YOUR_FUNCTION_URL/searchTSMaySQL \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Tìm máy biến áp 320kVA",
    "similarityThreshold": 0.3,
    "topN": 10
  }'
```

## Tự Động Chuyển Đổi

Hệ thống sẽ **tự động** sử dụng SQL Server nếu:
- `SQL_SERVER_HOST` environment variable được set
- SQL Server connection pool đã được khởi tạo
- Có dữ liệu trong SQL Server

Nếu SQL Server không available, hệ thống sẽ **tự động fallback** về Firestore.

## Schema SQL

### Table: TSMay

```sql
CREATE TABLE TSMay (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    DocumentId NVARCHAR(255) UNIQUE NOT NULL,
    DataJson NVARCHAR(MAX) NOT NULL,        -- Excel data as JSON
    EmbeddingJson NVARCHAR(MAX) NULL,        -- Vector embedding as JSON array
    ImportedAt DATETIME2 DEFAULT GETDATE(),
    RowIndex INT NULL,
    OriginalColumns NVARCHAR(MAX) NULL       -- Column names as JSON array
);
```

### Stored Procedures

- `sp_upsert_tsmay`: Insert/Update TSMay record
- `sp_search_tsmay_vector`: Search with vector similarity (returns candidates, similarity calculated in Node.js)

## Lợi Ích

1. **Performance:** SQL Server query nhanh hơn Firestore cho large datasets
2. **Scalability:** SQL Server có thể handle millions of records
3. **Vector Search:** Native support trong SQL Server 2025+
4. **Flexibility:** Có thể query phức tạp với SQL
5. **Backup:** Firestore vẫn giữ làm backup

## Migration Path

### Phase 1: Hybrid (Hiện tại)
- Firestore: Primary storage
- SQL Server: Optional, nếu configured thì dùng

### Phase 2: Full Migration
- SQL Server: Primary storage
- Firestore: Backup/Archive

### Phase 3: SQL Server 2025+
- Upgrade lên SQL Server 2025
- Sử dụng native VECTOR type
- Tối ưu performance với VECTOR_DISTANCE

## Troubleshooting

### Lỗi: "SQL Server modules not available"
- **Giải pháp:** Chạy `npm install mssql` trong thư mục `functions`

### Lỗi: "Connection timeout"
- **Giải pháp:** Kiểm tra firewall, network, và SQL Server configuration

### Lỗi: "Login failed"
- **Giải pháp:** Kiểm tra username/password trong Firebase Secrets

### Performance chậm
- **Giải pháp:** 
  - Tạo indexes trên DocumentId, ImportedAt
  - Sử dụng SQL Server 2025+ với native vector support
  - Tối ưu similarity threshold

## So Sánh với Firestore

| Tính năng | Firestore | SQL Server |
|-----------|-----------|------------|
| Vector Search | ✅ (tính trong Node.js) | ✅ (tính trong Node.js, 2025+ native) |
| Performance | ⚠️ Phụ thuộc vào số documents | ✅ Tối ưu với indexes |
| Scalability | ✅ Auto-scale | ✅ Manual scale |
| Cost | Pay per use | Fixed cost |
| Query Flexibility | ⚠️ Limited | ✅ Full SQL |
| Real-time | ✅ Yes | ❌ No |

## Next Steps

1. **Test migration:** Migrate một phần dữ liệu để test
2. **Monitor performance:** So sánh SQL vs Firestore
3. **Generate embeddings:** Tạo embeddings cho tất cả documents
4. **Upgrade to SQL Server 2025:** Khi available, upgrade để dùng native vector support
