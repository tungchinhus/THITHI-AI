# Sửa Lỗi: Không Lưu Được Dữ Liệu Vào SQL Server

## 🔍 Nguyên Nhân (Từ Logs)

Từ logs debug, tôi đã xác định được 2 vấn đề:

### 1. SQL Server Secrets Chưa Được Set (Nguyên Nhân Chính)

```
🔍 DEBUG: SQL Server config check {
  hasSqlConnection: true,
  hasSqlHost: false,      ← ❌ Chưa set
  hasSqlUser: false,      ← ❌ Chưa set
  hasSqlPassword: false,  ← ❌ Chưa set
  hasSqlDatabase: false   ← ❌ Chưa set
}
```

**Hệ quả:** Connection pool không được khởi tạo → Không lưu được vào SQL Server

### 2. UserInfo Không Được Gửi (Nguyên Nhân Phụ)

```
🔍 DEBUG: Save memory check {
  hasUserInfo: false,     ← ❌ User chưa đăng nhập
  userId: 'anonymous'
}
```

**Hệ quả:** Nếu user chưa đăng nhập, `getUserInfo()` trả về `undefined`

## ✅ Giải Pháp

### ⚠️ QUAN TRỌNG: Localhost Không Hoạt Động Trên Cloud

**Vấn đề:** `localhost:1433` chỉ hoạt động khi function chạy **local**, không hoạt động trên **Firebase Functions (cloud)**.

**Giải pháp:** Sử dụng một trong các cách sau:

#### Cách 1: Azure SQL Database (Khuyến nghị)
- Tạo Azure SQL Database
- Lấy connection string từ Azure Portal
- Sử dụng server name dạng: `your-server.database.windows.net`

#### Cách 2: SQL Server với Public IP
- Cấu hình SQL Server để listen trên public IP
- Mở firewall cho Azure/Firebase IP ranges
- Sử dụng public IP thay vì localhost

#### Cách 3: Sử dụng Firestore (Fallback - Đang hoạt động)
- Nếu không có SQL Server accessible từ cloud
- Hệ thống tự động fallback vào Firestore
- Dữ liệu vẫn được lưu bình thường

### Bước 1: Set SQL Server Secrets (Nếu dùng Azure SQL hoặc Public IP)

```bash
cd functions

# Set SQL Server Host (Azure SQL Database - Khuyến nghị)
echo "your-server.database.windows.net" | firebase functions:secrets:set SQL_SERVER_HOST

# HOẶC nếu dùng SQL Server với Public IP:
echo "your-public-ip-address" | firebase functions:secrets:set SQL_SERVER_HOST

# ⚠️ KHÔNG dùng "localhost" - không hoạt động trên cloud!

# Set SQL Server User
echo "your-username" | firebase functions:secrets:set SQL_SERVER_USER

# Set SQL Server Password
echo "your-password" | firebase functions:secrets:set SQL_SERVER_PASSWORD

# Set SQL Server Database
echo "THITHI_AI" | firebase functions:secrets:set SQL_SERVER_DATABASE

# Set SQL Server Port (Optional, default: 1433)
echo "1433" | firebase functions:secrets:set SQL_SERVER_PORT
```

### Bước 1b: Cấu Hình Azure SQL Database (Nếu chưa có)

1. Tạo Azure SQL Database:
   - Vào Azure Portal → Create SQL Database
   - Chọn Server (hoặc tạo mới)
   - Lấy server name: `your-server.database.windows.net`

2. Cấu hình Firewall:
   - Azure Portal → SQL Server → Networking
   - Thêm rule: Allow Azure services = Yes
   - Hoặc thêm Firebase Functions IP ranges

3. Lấy connection info:
   - Server name: `your-server.database.windows.net`
   - Database name: `THITHI_AI` (hoặc tên bạn chọn)
   - Username: Admin username
   - Password: Admin password

### Bước 2: Deploy Lại Function

```bash
cd functions
firebase deploy --only functions:chatFunction
```

### Bước 3: Test Lại

1. Gửi một message chat
2. Xem logs: `firebase functions:log --only chatFunction`
3. Tìm log: `✅ SQL Server connection pool initialized`
4. Tìm log: `✅ Chat memory saved to database`

## 📝 Lưu Ý

### Nếu SQL Server Chưa Được Cấu Hình

- ✅ **Hệ thống vẫn hoạt động bình thường!**
- Hệ thống sẽ tự động **fallback vào Firestore**
- Dữ liệu vẫn được lưu vào Firestore collections: `chatSessions` và `chatMemory`
- Chức năng nhớ sâu vẫn hoạt động (dựa trên `chatHistory` từ request)

### Nếu User Chưa Đăng Nhập

- Hệ thống vẫn lưu được với `userId: 'anonymous'`
- Nếu muốn lưu với user cụ thể, cần đăng nhập Firebase Auth trước

## 🔍 Kiểm Tra Sau Khi Set Secrets

Sau khi set secrets và deploy, kiểm tra logs:

```bash
firebase functions:log --only chatFunction
```

**Logs mong đợi:**
```
✅ SQL Server connection pool initialized for chat memory
✅ Chat session initialized: [session-id]
✅ Chat memory saved to database: { sessionId: ..., userMemoryId: ..., assistantMemoryId: ... }
```

**Nếu vẫn thấy:**
```
🔍 DEBUG: Skipping SQL save - conditions not met
reason: 'pool not initialized'
```

→ Kiểm tra lại secrets đã được set đúng chưa:
```bash
firebase functions:secrets:access SQL_SERVER_HOST
firebase functions:secrets:access SQL_SERVER_USER
firebase functions:secrets:access SQL_SERVER_DATABASE
```

---

**Tóm tắt:** Vấn đề chính là SQL Server secrets chưa được set. Sau khi set và deploy lại, hệ thống sẽ tự động lưu vào SQL Server thay vì Firestore.
