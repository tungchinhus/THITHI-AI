# Hướng Dẫn Debug: Nhớ Sâu và Gợi Ý Thông Minh

## 🚀 Hướng Dẫn Nhanh (Quick Start)

### Nếu Không Có Dữ Liệu Trong SQL Server

**Bước 1: Kiểm tra nhanh**
```bash
# Kiểm tra SQL Server có được cấu hình không
cd functions
firebase functions:secrets:access SQL_SERVER_HOST
```

**Nếu không có giá trị:**
- ✅ **Bình thường!** Hệ thống đang fallback vào Firestore
- Kiểm tra Firestore: Firebase Console → Firestore → Collections `chatSessions` và `chatMemory`
- Nếu muốn dùng SQL Server, cần cấu hình secrets (xem Bước 2)

**Nếu có giá trị:**
- Chạy test script: `node test-chat-memory.js`
- Xem logs: `firebase functions:log --only chatFunction --limit 50`

**Bước 2: Cấu hình SQL Server (nếu muốn dùng)**
```bash
cd functions
echo "your-server.database.windows.net" | firebase functions:secrets:set SQL_SERVER_HOST
echo "your-username" | firebase functions:secrets:set SQL_SERVER_USER
echo "your-password" | firebase functions:secrets:set SQL_SERVER_PASSWORD
echo "THITHI_AI" | firebase functions:secrets:set SQL_SERVER_DATABASE

# Deploy lại
firebase deploy --only functions:chatFunction
```

**Bước 3: Chạy test**
```bash
node test-chat-memory.js
```

---

## Kiểm Tra Hệ Thống Có Hoạt Động

### Bước 1: Kiểm Tra Logs

Sau khi gửi message, kiểm tra logs trong Firebase Functions:

```bash
firebase functions:log --only chatFunction --limit 50
```

Tìm các log sau:

#### ✅ Logs Thành Công

```
✅ SQL Server modules loaded
✅ SQL Server connection pool initialized for chat memory
✅ Chat session initialized: [session-id]
✅ Found X relevant memories from chat history
✅ Chat memory saved to database: { sessionId: ..., userMemoryId: ..., assistantMemoryId: ... }
```

#### ⚠️ Logs Cảnh Báo

```
⚠️ SQL Server modules not available (optional): ...
⚠️ Failed to initialize SQL Server connection pool: ...
⚠️ Failed to initialize chat memory service: ...
⚠️ Error saving chat memory: ...
```

#### ℹ️ Logs Thông Tin

```
ℹ️ Chat memory service not available: { hasService: true/false, sqlPoolInitialized: true/false, hasHost: true/false }
ℹ️ Using chatHistory from request (SQL Server not available)
ℹ️ No similar memories found in chat history
```

### Bước 2: Kiểm Tra SQL Server Connection

#### 2.1. Kiểm Tra Secrets Đã Set

```bash
cd functions
firebase functions:secrets:access SQL_SERVER_HOST
firebase functions:secrets:access SQL_SERVER_USER
firebase functions:secrets:access SQL_SERVER_DATABASE
```

Nếu không có giá trị, cần set lại:

```bash
echo "your-server.database.windows.net" | firebase functions:secrets:set SQL_SERVER_HOST
echo "your-username" | firebase functions:secrets:set SQL_SERVER_USER
echo "your-password" | firebase functions:secrets:set SQL_SERVER_PASSWORD
echo "THITHI_AI" | firebase functions:secrets:set SQL_SERVER_DATABASE
```

#### 2.2. Kiểm Tra Database Schema

Kết nối SQL Server và kiểm tra:

```sql
-- Kiểm tra bảng đã tồn tại
SELECT * FROM sys.tables WHERE name IN ('ChatSessions', 'ChatMemory');

-- Kiểm tra stored procedures
SELECT * FROM sys.procedures WHERE name LIKE 'sp_%chat%';

-- Kiểm tra dữ liệu
SELECT COUNT(*) as SessionCount FROM ChatSessions;
SELECT COUNT(*) as MemoryCount FROM ChatMemory;

-- Nếu không có dữ liệu, kiểm tra:
-- 1. SQL Server có được cấu hình không?
-- 2. Connection pool có được khởi tạo không?
-- 3. Có đang fallback vào Firestore không?
```

### Bước 2.3: Kiểm Tra Tại Sao Không Có Dữ Liệu

#### Kiểm Tra 1: SQL Server Có Được Cấu Hình?

```bash
# Kiểm tra secrets
cd functions
firebase functions:secrets:access SQL_SERVER_HOST
```

**Nếu không có giá trị:**
- SQL Server chưa được cấu hình
- Hệ thống đang fallback vào Firestore
- Kiểm tra Firestore collections: `chatSessions` và `chatMemory`

#### Kiểm Tra 2: Connection Pool Có Được Khởi Tạo?

Xem logs trong Firebase Functions:

```bash
firebase functions:log --only chatFunction --limit 100 | grep -i "sql\|memory\|session"
```

Tìm các log:
- `✅ SQL Server connection pool initialized` - Pool đã khởi tạo
- `⚠️ Failed to initialize SQL Server connection pool` - Pool khởi tạo thất bại
- `ℹ️ Chat memory service not available` - Service không available

#### Kiểm Tra 3: Có Đang Fallback Vào Firestore?

1. Vào Firebase Console → Firestore
2. Kiểm tra collections:
   - `chatSessions` - Nếu có dữ liệu ở đây, đang fallback vào Firestore
   - `chatMemory` - Nếu có dữ liệu ở đây, đang fallback vào Firestore

**Nếu có dữ liệu trong Firestore:**
- SQL Server không available hoặc chưa được cấu hình
- Hệ thống đang hoạt động bình thường với Firestore fallback
- Để dùng SQL Server, cần cấu hình secrets

#### Kiểm Tra 4: Có Lỗi Khi Lưu?

Xem logs chi tiết:

```bash
firebase functions:log --only chatFunction --limit 100 | grep -i "error\|warn\|memory"
```

Tìm các lỗi:
- `⚠️ Error saving chat memory` - Lỗi khi lưu vào SQL Server
- `⚠️ Error saving chat memory to Firestore` - Lỗi khi lưu vào Firestore
- `❌ Error saving chat memory` - Lỗi nghiêm trọng

### Bước 3: Kiểm Tra Firestore Fallback

Nếu SQL Server không available, hệ thống sẽ tự động lưu vào Firestore:

1. Vào Firebase Console → Firestore
2. Kiểm tra collections:
   - `chatSessions` - Chứa thông tin session
   - `chatMemory` - Chứa chat messages

### Bước 2.4: Chạy Test Script

Chạy script test để kiểm tra toàn bộ hệ thống:

```bash
cd functions
node test-chat-memory.js
```

Script sẽ:
1. ✅ Kiểm tra SQL Server configuration
2. ✅ Khởi tạo connection pool
3. ✅ Tạo session test
4. ✅ Lưu chat memory
5. ✅ Tìm kiếm memory
6. ✅ Kiểm tra dữ liệu trong database

**Kết quả mong đợi:**
- Nếu SQL Server được cấu hình: Dữ liệu sẽ được lưu vào SQL Server
- Nếu SQL Server không được cấu hình: Dữ liệu sẽ được lưu vào Firestore (fallback)

### Bước 4: Test Thủ Công

#### Test 1: Gửi Message Đầu Tiên

```bash
curl -X POST https://YOUR_FUNCTION_URL/chatFunction \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Tên tôi là CHINH",
    "userInfo": {
      "email": "test@example.com",
      "uid": "test-user-123"
    }
  }'
```

**Kỳ vọng:**
- Log: `✅ Chat session initialized: [session-id]`
- Log: `✅ Chat memory saved to database` hoặc `✅ Chat memory saved to Firestore`

#### Test 2: Gửi Message Thứ Hai (Kiểm Tra Nhớ)

```bash
curl -X POST https://YOUR_FUNCTION_URL/chatFunction \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Tôi tên gì?",
    "userInfo": {
      "email": "test@example.com",
      "uid": "test-user-123"
    },
    "chatHistory": [
      {
        "role": "user",
        "content": "Tên tôi là CHINH"
      },
      {
        "role": "assistant",
        "content": "Chào Chinh! Tôi sẽ nhớ tên bạn."
      }
    ]
  }'
```

**Kỳ vọng:**
- Log: `✅ Found X relevant memories from chat history`
- AI trả lời: "Tên bạn là CHINH" (nhớ được!)

### Bước 5: Debug Chi Tiết

#### 5.1. Kiểm Tra SQL Connection Pool

Thêm vào code để debug:

```javascript
// Trong functions/index.js, sau khi khởi tạo pool
if (sqlConnection) {
  const pool = sqlConnection.getSQLPool();
  console.log('SQL Pool Status:', {
    exists: !!pool,
    connected: pool?.connected,
    pending: pool?.pending
  });
}
```

#### 5.2. Kiểm Tra Chat Memory Service

```javascript
// Trong functions/index.js
console.log('Chat Memory Service Status:', {
  hasService: !!sqlChatMemoryService,
  hasEmbeddingFn: !!generateEmbeddingFn,
  sqlPoolInitialized: sqlPoolInitialized
});
```

#### 5.3. Kiểm Tra Session ID

```javascript
// Trong functions/index.js, sau khi tạo session
console.log('Session Info:', {
  userId: userId,
  sessionId: chatSessionId,
  hasSession: !!chatSessionId
});
```

## Các Vấn Đề Thường Gặp

### Vấn Đề 1: "SQL Server modules not available"

**Nguyên nhân:**
- File `sql-connection.js` hoặc `sql-chat-memory-service.js` không tồn tại
- Package `mssql` chưa được cài đặt

**Giải pháp:**
```bash
cd functions
npm install mssql
# Kiểm tra file tồn tại
ls sql-connection.js sql-chat-memory-service.js
```

### Vấn Đề 2: "Failed to initialize SQL Server connection pool"

**Nguyên nhân:**
- SQL Server không accessible
- Credentials sai
- Firewall chặn connection
- Database chưa được tạo

**Giải pháp:**
1. Kiểm tra SQL Server có chạy không
2. Kiểm tra credentials trong secrets
3. Kiểm tra firewall rules
4. Kiểm tra database đã tồn tại chưa

### Vấn Đề 3: "Chat session initialized: null"

**Nguyên nhân:**
- Stored procedure `sp_upsert_chat_session` chưa được tạo
- Database schema chưa được chạy

**Giải pháp:**
```sql
-- Chạy lại schema
-- File: functions/sql-schema.sql
```

### Vấn Đề 4: "No similar memories found"

**Nguyên nhân:**
- Chưa có dữ liệu trong database
- Similarity threshold quá cao
- Embedding chưa được generate

**Giải pháp:**
1. Gửi vài messages trước để tạo dữ liệu
2. Giảm similarity threshold (mặc định: 0.4)
3. Kiểm tra VectorData có NULL không

### Vấn Đề 5: Session Không Được Lưu

**Nguyên nhân:**
- SQL Server không available và Firestore fallback fail
- userInfo không có

**Giải pháp:**
1. Kiểm tra logs để xem fallback có chạy không
2. Đảm bảo `userInfo` được gửi trong request
3. Kiểm tra Firestore rules

## Checklist Debug

- [ ] SQL Server secrets đã được set
- [ ] Database schema đã được chạy
- [ ] SQL connection pool khởi tạo thành công
- [ ] Chat session được tạo
- [ ] Chat memory được lưu (SQL hoặc Firestore)
- [ ] Memory search hoạt động
- [ ] Suggestions được enhance

## Liên Hệ & Hỗ Trợ

Nếu vẫn gặp vấn đề:
1. Xem logs chi tiết: `firebase functions:log --only chatFunction`
2. Kiểm tra SQL Server connection
3. Kiểm tra Firestore fallback
4. Xem file `HUONG_DAN_NHO_SAU_VA_GOI_Y_THONG_MINH.md`

---

**Phiên bản**: 1.0.0  
**Cập nhật**: 2024-01-09
