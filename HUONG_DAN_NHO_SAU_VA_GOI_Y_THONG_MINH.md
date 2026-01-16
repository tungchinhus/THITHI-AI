# Hướng Dẫn: Nhớ Sâu và Gợi Ý Thông Minh Theo Ngữ Cảnh

## Tổng Quan

Hệ thống THIHI AI đã được nâng cấp với tính năng **Nhớ Sâu (Deep Memory)** và **Gợi Ý Thông Minh Theo Ngữ Cảnh (Context-Aware Intelligent Suggestions)** sử dụng vector embeddings và SQL Server.

### Tính Năng Mới

1. **Nhớ Sâu (Deep Memory)**
   - Lưu trữ tất cả cuộc trò chuyện với vector embeddings
   - Tìm kiếm ngữ cảnh từ các cuộc trò chuyện trước dựa trên semantic similarity
   - Hiểu ngữ cảnh sâu hơn từ lịch sử chat

2. **Gợi Ý Thông Minh Theo Ngữ Cảnh**
   - Gợi ý dựa trên các cuộc trò chuyện tương tự trước đó
   - Phân tích pattern từ lịch sử chat
   - Đề xuất câu hỏi tiếp theo phù hợp với ngữ cảnh

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
                  │  ChatMemory │
                  │  (Vectors)  │
                  └─────────────┘
```

## Cài Đặt

### Bước 1: Tạo Database Schema

Chạy file SQL schema để tạo các bảng cần thiết:

```sql
-- Chạy file functions/sql-schema.sql trong SQL Server Management Studio
-- Hoặc sử dụng Azure Data Studio
```

Schema bao gồm:
- **ChatSessions**: Lưu thông tin session chat
- **ChatMemory**: Lưu chat messages với vector embeddings

### Bước 2: Cấu Hình SQL Server

Đảm bảo các biến môi trường sau được cấu hình trong Firebase Secrets:

#### 2.1. Set SQL Server Host

```bash
cd functions

# Cách 1: Nhập trực tiếp (Windows PowerShell)
echo "your-sql-server.database.windows.net" | firebase functions:secrets:set SQL_SERVER_HOST
# Hoặc cho local SQL Server:
echo "localhost" | firebase functions:secrets:set SQL_SERVER_HOST

# Cách 2: Từ file (an toàn hơn)
echo "your-sql-server.database.windows.net" > temp-sql-host.txt
Get-Content temp-sql-host.txt | firebase functions:secrets:set SQL_SERVER_HOST
del temp-sql-host.txt  # Xóa file tạm
```

**Giá trị ví dụ:**
- Azure SQL: `your-server.database.windows.net`
- Local SQL Server: `localhost` hoặc `127.0.0.1`
- SQL Server với named instance: `localhost\SQLEXPRESS`

#### 2.2. Set SQL Server User

```bash
echo "your-username" | firebase functions:secrets:set SQL_SERVER_USER
```

**Giá trị ví dụ:**
- Azure SQL: `your-admin@your-server`
- Local SQL Server: `sa` hoặc tên user của bạn

#### 2.3. Set SQL Server Password

```bash
# ⚠️ QUAN TRỌNG: Không hiển thị password trong terminal
echo "your-password" | firebase functions:secrets:set SQL_SERVER_PASSWORD
```

**Lưu ý bảo mật:**
- Password sẽ được ẩn khi nhập
- Không commit password vào Git
- Sử dụng strong password cho production

#### 2.4. Set SQL Server Database

```bash
echo "THITHI_AI" | firebase functions:secrets:set SQL_SERVER_DATABASE
```

**Giá trị:** Tên database đã tạo ở Bước 1 (thường là `THITHI_AI`)

#### 2.5. Set SQL Server Port (Optional)

```bash
echo "1433" | firebase functions:secrets:set SQL_SERVER_PORT
```

**Giá trị mặc định:** `1433` (SQL Server default port)

**Lưu ý:** Bước này là tùy chọn, nếu không set sẽ dùng port 1433.

#### 2.6. Kiểm Tra Secrets Đã Set

```bash
# Xem danh sách secrets
firebase functions:secrets:access SQL_SERVER_HOST
firebase functions:secrets:access SQL_SERVER_USER
firebase functions:secrets:access SQL_SERVER_DATABASE
# ⚠️ Không nên xem password trực tiếp

# Hoặc xem tất cả secrets
firebase functions:secrets:list
```

#### 2.7. Ví Dụ Hoàn Chỉnh (Azure SQL)

```bash
cd functions

# Set tất cả secrets
echo "your-server.database.windows.net" | firebase functions:secrets:set SQL_SERVER_HOST
echo "admin@your-server" | firebase functions:secrets:set SQL_SERVER_USER
echo "YourStrongPassword123!" | firebase functions:secrets:set SQL_SERVER_PASSWORD
echo "THITHI_AI" | firebase functions:secrets:set SQL_SERVER_DATABASE
echo "1433" | firebase functions:secrets:set SQL_SERVER_PORT
```

#### 2.8. Ví Dụ Hoàn Chỉnh (Local SQL Server)

```bash
cd functions

# Set tất cả secrets
echo "localhost" | firebase functions:secrets:set SQL_SERVER_HOST
echo "sa" | firebase functions:secrets:set SQL_SERVER_USER
echo "YourLocalPassword" | firebase functions:secrets:set SQL_SERVER_PASSWORD
echo "THITHI_AI" | firebase functions:secrets:set SQL_SERVER_DATABASE
# Port mặc định 1433, không cần set
```

### Bước 3: Deploy Functions

```bash
cd functions
firebase deploy --only functions:chatFunction
```

## Cách Hoạt Động

### 1. Lưu Chat Memory

Khi người dùng gửi message:

1. **Tạo/Cập nhật Session**: Hệ thống tự động tạo hoặc cập nhật chat session
2. **Generate Embedding**: Tạo vector embedding cho message bằng Gemini API
3. **Lưu vào Database**: Lưu message và embedding vào bảng `ChatMemory`

```javascript
// Tự động được thực hiện trong chatFunction
await sqlChatMemoryService.saveChatMemory(
  userId,
  question,
  'user',
  sessionId,
  { timestamp, suggestions }
);
```

### 2. Tìm Kiếm Ngữ Cảnh

Khi xử lý câu hỏi mới:

1. **Generate Query Embedding**: Tạo embedding cho câu hỏi hiện tại
2. **Vector Search**: Tìm các messages tương tự trong lịch sử
3. **Thêm vào Context**: Đưa thông tin tìm được vào prompt cho AI

```javascript
const similarMemories = await sqlChatMemoryService.searchChatMemory(
  userId,
  question,
  {
    similarityThreshold: 0.4,
    topN: 5,
    sessionId: chatSessionId
  }
);
```

### 3. Gợi Ý Thông Minh

Sau khi AI trả lời:

1. **Tìm Similar Queries**: Tìm các câu hỏi tương tự trong lịch sử
2. **Extract Patterns**: Phân tích pattern từ các cuộc trò chuyện tương tự
3. **Generate Suggestions**: Tạo gợi ý dựa trên pattern và metadata

```javascript
const contextAwareSuggestions = await sqlChatMemoryService.getContextAwareSuggestions(
  userId,
  question,
  {
    maxSuggestions: 3,
    sessionId: chatSessionId
  }
);
```

## Schema Database

### ChatSessions

```sql
CREATE TABLE ChatSessions (
    SessionId UNIQUEIDENTIFIER PRIMARY KEY,
    UserId NVARCHAR(255) NOT NULL,
    Title NVARCHAR(500) NULL,
    StartedAt DATETIME2 DEFAULT GETDATE(),
    LastActivityAt DATETIME2 DEFAULT GETDATE(),
    MessageCount INT DEFAULT 0,
    IsActive BIT DEFAULT 1
);
```

### ChatMemory

```sql
CREATE TABLE ChatMemory (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId NVARCHAR(255) NOT NULL,
    SessionId UNIQUEIDENTIFIER NULL,
    [Content] NVARCHAR(MAX) NOT NULL,
    VectorData NVARCHAR(MAX) NULL,  -- JSON array of floats
    ContentType NVARCHAR(50) NOT NULL,  -- 'user' or 'assistant'
    Metadata NVARCHAR(MAX) NULL,  -- JSON metadata
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);
```

## API Reference

### sqlChatMemoryService.upsertChatSession

Tạo hoặc cập nhật chat session.

```javascript
const sessionId = await sqlChatMemoryService.upsertChatSession(
  userId,
  title,  // Optional
  existingSessionId  // Optional
);
```

### sqlChatMemoryService.saveChatMemory

Lưu chat message với vector embedding.

```javascript
const memoryId = await sqlChatMemoryService.saveChatMemory(
  userId,
  content,
  contentType,  // 'user' or 'assistant'
  sessionId,  // Optional
  metadata  // Optional
);
```

### sqlChatMemoryService.searchChatMemory

Tìm kiếm chat memory dựa trên vector similarity.

```javascript
const memories = await sqlChatMemoryService.searchChatMemory(
  userId,
  query,
  {
    similarityThreshold: 0.3,
    topN: 10,
    sessionId: null,  // Optional: filter by session
    contentType: null  // Optional: 'user' or 'assistant'
  }
);
```

### sqlChatMemoryService.getContextAwareSuggestions

Lấy gợi ý thông minh dựa trên ngữ cảnh.

```javascript
const suggestions = await sqlChatMemoryService.getContextAwareSuggestions(
  userId,
  currentQuery,
  {
    maxSuggestions: 3,
    sessionId: null  // Optional
  }
);
```

## Ví Dụ Sử Dụng

### Ví Dụ 1: Nhớ Sâu

**User**: "Tên tôi là CHINH"
**AI**: "Chào Chinh! Tôi sẽ nhớ tên bạn."

**User**: "Tôi tên gì?"
**AI**: "Tên bạn là CHINH" ✅ (Nhớ được từ memory!)

### Ví Dụ 2: Gợi Ý Thông Minh

**User**: "Hạn mức đi SG là bao nhiêu?"
**AI**: "Hạn mức công tác phí tại TP. Hồ Chí Minh là 2.500.000 VNĐ/ngày"
**Suggestions**: 
- "Xem chi tiết bảng định mức các tỉnh khác"
- "Tải mẫu tờ trình công tác phí"
- "Quy định về vé máy bay hạng thương gia"

### Ví Dụ 3: Hiểu Ngữ Cảnh Sâu

**User**: "Hạn mức đi SG là bao nhiêu?"
**AI**: "Hạn mức công tác phí tại TP. Hồ Chí Minh là 2.500.000 VNĐ/ngày"

**User**: "Còn Hà Nội thì sao?"
**AI**: "Hạn mức công tác phí tại Hà Nội là 2.000.000 VNĐ/ngày" ✅
*(AI hiểu "còn" = hỏi tiếp về Hà Nội dựa trên context)*

## Troubleshooting

### Lỗi: "SQL Server modules not available"

**Giải pháp**: 
- Kiểm tra file `functions/sql-connection.js` và `functions/sql-chat-memory-service.js` có tồn tại
- Đảm bảo đã cài đặt package `mssql`: 
  ```bash
  cd functions
  npm install mssql
  ```

### Lỗi: "Failed to set secret" hoặc "Secret not found"

**Giải pháp**:
- Kiểm tra đã đăng nhập Firebase: `firebase login`
- Kiểm tra đã chọn đúng project: `firebase use YOUR_PROJECT_ID`
- Kiểm tra Secret Manager đã được enable trong Firebase Console
- Thử set lại secret với giá trị mới

### Lỗi: "Secret access denied" hoặc "Permission denied"

**Giải pháp**:
- Đảm bảo bạn có quyền "Cloud Functions Admin" hoặc "Owner" trong Firebase project
- Kiểm tra IAM permissions trong Google Cloud Console
- Liên hệ admin để cấp quyền truy cập Secret Manager

### Lỗi: "Connection timeout"

**Giải pháp**:
- Kiểm tra firewall và network
- Kiểm tra SQL Server configuration
- Kiểm tra credentials trong Firebase Secrets

### Lỗi: "Failed to generate embedding"

**Giải pháp**:
- Kiểm tra `GEMINI_API_KEY` đã được cấu hình
- Kiểm tra quota của Gemini API
- Hệ thống sẽ tự động fallback về text search nếu embedding fail

### Memory không được lưu

**Giải pháp**:
- Kiểm tra logs: `firebase functions:log --only chatFunction`
- Kiểm tra SQL Server connection
- Kiểm tra `SQL_SERVER_HOST` environment variable

### Suggestions không cải thiện

**Giải pháp**:
- Đảm bảo đã có đủ chat history trong database
- Kiểm tra similarity threshold (mặc định: 0.4)
- Xem logs để debug: `firebase functions:log --only chatFunction`

## Best Practices

### 1. Quản Lý Session

- Mỗi user nên có session riêng
- Session tự động được tạo khi user bắt đầu chat
- Session được cập nhật mỗi khi có message mới

### 2. Similarity Threshold

- **0.3-0.4**: Tìm kiếm rộng, nhiều kết quả
- **0.5-0.6**: Tìm kiếm vừa phải
- **0.7+**: Tìm kiếm chặt chẽ, chỉ kết quả rất tương tự

### 3. Performance

- Sử dụng indexes trên `UserId`, `SessionId`, `CreatedAt`
- Giới hạn số lượng records trả về (`topN`)
- Cache embeddings nếu có thể

### 4. Privacy

- Chỉ lưu memory cho user đã đăng nhập
- Có thể xóa memory theo user hoặc session
- Tuân thủ GDPR và các quy định bảo mật

## Migration Path

### Phase 1: Hybrid (Hiện tại)
- SQL Server: Primary storage cho chat memory
- Firestore: Backup/Archive (optional)

### Phase 2: Full Migration
- Tất cả chat memory lưu trong SQL Server
- Vector search được tối ưu với indexes

### Phase 3: SQL Server 2025+
- Upgrade lên SQL Server 2025
- Sử dụng native `VECTOR` type
- Tối ưu performance với `VECTOR_DISTANCE`

## Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra logs: `firebase functions:log --only chatFunction`
2. Kiểm tra SQL Server connection
3. Xem các file hướng dẫn khác:
   - `HUONG_DAN_SQL_SERVER_VECTOR.md`
   - `HUONG_DAN_SU_DUNG.md`

---

**Phiên bản**: 1.0.0  
**Cập nhật**: 2024-01-09
