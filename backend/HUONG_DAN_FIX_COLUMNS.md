# Hướng Dẫn Fix Lỗi "Invalid column name 'Content'" hoặc "Invalid column name 'VectorJson'"

## 🔴 Lỗi

Khi import Excel, bạn gặp lỗi:
```
Invalid column name 'Content'.
Invalid column name 'VectorJson'.
```

## 🔍 Nguyên Nhân

Bảng đã tồn tại trong database nhưng **thiếu các cột** `Content` và `VectorJson` mà code cần để insert dữ liệu.

Điều này có thể xảy ra nếu:
- Bảng được tạo từ script khác (không có các cột này)
- Bảng được tạo từ lần import trước với code cũ
- Bảng được tạo thủ công với cấu trúc khác

## ✅ Giải Pháp

### Cách 1: Dùng Script SQL (Khuyến Nghị)

1. Mở **SQL Server Management Studio (SSMS)**
2. Kết nối đến database `THITHI_AI`
3. Mở file `FIX_TABLE_COLUMNS.sql`
4. **Thay đổi tên bảng** trong script (dòng 5):
   ```sql
   DECLARE @tableName NVARCHAR(255) = 'TSMay'; -- Thay 'TSMay' bằng tên bảng của bạn
   ```
5. Chạy script (F5)
6. Script sẽ tự động:
   - Kiểm tra xem các cột `Content`, `VectorJson`, `Embedding` có tồn tại không
   - Thêm các cột nếu chưa có
   - Hiển thị cấu trúc bảng sau khi fix

### Cách 2: Sửa Thủ Công Bằng SQL

Chạy các lệnh SQL sau trong SSMS:

```sql
-- Thay 'TSMay' bằng tên bảng của bạn
USE THITHI_AI;
GO

-- Thêm cột Content nếu chưa có
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
    AND TABLE_NAME = 'TSMay' 
    AND COLUMN_NAME = 'Content'
)
BEGIN
    ALTER TABLE dbo.[TSMay] ADD Content NVARCHAR(MAX);
    PRINT 'Đã thêm cột Content';
END

-- Thêm cột VectorJson nếu chưa có
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
    AND TABLE_NAME = 'TSMay' 
    AND COLUMN_NAME = 'VectorJson'
)
BEGIN
    ALTER TABLE dbo.[TSMay] ADD VectorJson NVARCHAR(MAX) NULL;
    PRINT 'Đã thêm cột VectorJson';
END
GO
```

### Cách 3: Xóa Bảng Cũ và Tạo Lại (Nếu Không Cần Dữ Liệu Cũ)

⚠️ **CẢNH BÁO:** Cách này sẽ **XÓA TẤT CẢ DỮ LIỆU** trong bảng!

```sql
USE THITHI_AI;
GO

-- Xóa bảng cũ
DROP TABLE IF EXISTS dbo.[TSMay]; -- Thay 'TSMay' bằng tên bảng của bạn
GO

-- Bảng sẽ được tạo tự động khi import lại
```

Sau đó import lại Excel, code sẽ tự động tạo bảng với cấu trúc đúng.

## 🔧 Code Đã Được Sửa

Code backend đã được cập nhật để **tự động thêm các cột** `Content` và `VectorJson` nếu chúng chưa tồn tại. 

Sau khi rebuild và restart backend, lần import tiếp theo sẽ tự động fix các cột thiếu.

## 📋 Kiểm Tra Sau Khi Fix

Chạy query này để kiểm tra cấu trúc bảng:

```sql
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' 
AND TABLE_NAME = 'TSMay' -- Thay bằng tên bảng của bạn
ORDER BY ORDINAL_POSITION;
```

Bạn sẽ thấy các cột:
- ✅ `ID` (INT, IDENTITY)
- ✅ `Content` (NVARCHAR(MAX))
- ✅ `VectorJson` (NVARCHAR(MAX), NULL)
- ✅ `Embedding` (VECTOR(384), NULL) - nếu SQL Server 2025+
- ✅ Các cột động từ Excel

## 🚀 Sau Khi Fix

1. **Rebuild và restart backend:**
   ```powershell
   cd C:\MyData\projects\THITHI\THIHI_AI\backend
   .\restart-backend.bat
   ```

2. **Thử import lại Excel**

3. Import sẽ thành công! ✅

## ⚠️ Lưu Ý

- Nếu bảng đã có dữ liệu, các cột mới được thêm sẽ có giá trị `NULL` cho các dòng cũ
- Bạn có thể cần re-import để populate dữ liệu vào các cột mới
- Nếu muốn giữ dữ liệu cũ, dùng Cách 1 hoặc Cách 2
- Nếu không cần dữ liệu cũ, dùng Cách 3 (xóa và tạo lại)
