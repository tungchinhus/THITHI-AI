# Hướng dẫn Fix VECTOR Support trong SQL Server 2025

## Tình trạng hiện tại

✅ **VECTOR type đã tồn tại** trong SQL Server (system_type_id = 165)
⚠️ **Database Compatibility Level**: 170 (SQL Server 2022) - Cần nâng lên 180
❌ **VECTOR type chưa hoạt động** do compatibility level chưa đúng

## Giải pháp

### Cách 1: Set Compatibility Level bằng SQL Server Management Studio (SSMS) - **KHUYẾN NGHỊ**

1. **Mở SQL Server Management Studio (SSMS)**
2. **Kết nối đến SQL Server** của bạn
3. **Chuột phải vào database `THITHI_AI`** → Properties
4. **Chọn tab "Options"**
5. **Tìm "Compatibility level"** trong danh sách
6. **Chọn "SQL Server 2025 (180)"** từ dropdown
7. **Click OK** để lưu

### Cách 2: Set Compatibility Level bằng SQL Script

Chạy script sau trong SSMS (cần quyền ALTER DATABASE):

```sql
USE master;
GO

-- Set compatibility level to 180 (SQL Server 2025)
ALTER DATABASE [THITHI_AI] SET COMPATIBILITY_LEVEL = 180;
GO

-- Verify
SELECT 
    name,
    compatibility_level,
    CASE 
        WHEN compatibility_level = 180 THEN 'OK - SQL Server 2025'
        ELSE 'Need to set to 180'
    END AS Status
FROM sys.databases 
WHERE name = 'THITHI_AI';
GO
```

**Lưu ý**: Nếu gặp lỗi "database is in use", bạn có thể cần:
- Đóng tất cả connections đến database
- Hoặc dùng single_user mode:

```sql
USE master;
GO

-- Set to single user mode
ALTER DATABASE [THITHI_AI] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

-- Set compatibility level
ALTER DATABASE [THITHI_AI] SET COMPATIBILITY_LEVEL = 180;
GO

-- Set back to multi user
ALTER DATABASE [THITHI_AI] SET MULTI_USER;
GO
```

### Cách 3: Kiểm tra và Enable VECTOR Feature (nếu cần)

Một số version SQL Server 2025 có thể cần enable VECTOR feature:

```sql
-- Check if VECTOR feature needs to be enabled
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
GO

-- Check current configuration
EXEC sp_configure;
GO

-- If there's a 'vector' or 'ai' related configuration, enable it
-- (This depends on your SQL Server installation)
```

## Sau khi set Compatibility Level

### Bước 1: Verify Compatibility Level

```sql
USE THITHI_AI;
GO

SELECT 
    name,
    compatibility_level,
    CASE 
        WHEN compatibility_level = 180 THEN '✅ OK'
        ELSE '❌ Need to set to 180'
    END AS Status
FROM sys.databases 
WHERE name = 'THITHI_AI';
```

### Bước 2: Test VECTOR Type

```sql
USE THITHI_AI;
GO

-- Test creating a VECTOR column
IF OBJECT_ID('tempdb..#test_vector') IS NOT NULL
    DROP TABLE #test_vector;
GO

CREATE TABLE #test_vector (
    id INT IDENTITY(1,1) PRIMARY KEY,
    test_vector VECTOR(384) NULL
);
GO

-- Test inserting a vector
DECLARE @testVec VECTOR(384) = CAST('[0.1,0.2,0.3]' AS VECTOR(384));
INSERT INTO #test_vector (test_vector) VALUES (@testVec);
GO

-- Test VECTOR_DISTANCE function
DECLARE @vec1 VECTOR(384) = CAST('[0.1,0.2,0.3]' AS VECTOR(384));
DECLARE @vec2 VECTOR(384) = CAST('[0.2,0.3,0.4]' AS VECTOR(384));
SELECT VECTOR_DISTANCE(@vec1, @vec2, COSINE) AS CosineDistance;
GO

DROP TABLE #test_vector;
GO
```

Nếu test thành công, bạn sẽ thấy:
- ✅ Table được tạo thành công
- ✅ Insert vector thành công
- ✅ VECTOR_DISTANCE trả về giá trị (0-2 range)

### Bước 3: Chạy lại Migration Script

Sau khi compatibility level đã được set đúng:

```powershell
cd C:\MyData\projects\THITHI\THIHI_AI
.\run-sql-migration.ps1
```

## Troubleshooting

### Lỗi: "Cannot find the object 'VECTOR'"

**Nguyên nhân**: Compatibility level chưa đúng hoặc VECTOR type chưa được enable

**Giải pháp**:
1. Đảm bảo compatibility level = 180
2. Kiểm tra SQL Server version >= 17.0
3. Restart SQL Server service nếu cần

### Lỗi: "Invalid object name 'VECTOR'"

**Nguyên nhân**: VECTOR type không tồn tại trong version này

**Giải pháp**:
1. Update SQL Server 2025 lên CU mới nhất
2. Hoặc sử dụng Azure SQL Database
3. Code sẽ tự động fallback về JSON mode

### Lỗi khi set Compatibility Level

**Nguyên nhân**: Database đang được sử dụng hoặc không có quyền

**Giải pháp**:
1. Đóng tất cả connections
2. Dùng single_user mode (xem Cách 2 ở trên)
3. Đảm bảo có quyền ALTER DATABASE

## Kiểm tra lại sau khi fix

Chạy script kiểm tra:

```powershell
.\check-vector-support.ps1
```

Kết quả mong đợi:
- ✅ Database Compatibility Level: 180
- ✅ VECTOR Type Exists: YES
- ✅ Can Create VECTOR Column: OK

## Nếu vẫn không hoạt động

Nếu sau khi set compatibility level = 180 mà VECTOR vẫn không hoạt động:

1. **Kiểm tra SQL Server Edition**:
   - VECTOR có thể chỉ có trong Enterprise/Developer edition
   - Standard Edition có thể không hỗ trợ đầy đủ

2. **Kiểm tra CU version**:
   - Cần SQL Server 2025 CU1 trở lên
   - Version hiện tại: 17.0.4005.7 (cần verify)

3. **Alternative**: Sử dụng JSON mode
   - Code đã tự động fallback
   - Performance vẫn tốt với dữ liệu vừa phải

## Liên kết hữu ích

- [SQL Server 2025 Compatibility Levels](https://learn.microsoft.com/sql/t-sql/statements/alter-database-transact-sql-compatibility-level)
- [VECTOR Data Type Documentation](https://learn.microsoft.com/sql/relational-databases/vector-search)
- [SQL Server 2025 Release Notes](https://learn.microsoft.com/sql/sql-server/what-s-new-in-sql-server-2025)
