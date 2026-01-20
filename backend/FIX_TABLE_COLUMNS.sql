-- Script để fix các bảng đã tồn tại thiếu cột Content và VectorJson
-- Chạy script này nếu gặp lỗi "Invalid column name 'Content'" hoặc "Invalid column name 'VectorJson'"

-- Thay 'TSMay' bằng tên bảng của bạn
DECLARE @tableName NVARCHAR(255) = 'TSMay'; -- Thay đổi tên bảng ở đây

-- Kiểm tra và thêm cột Content nếu chưa có
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
    AND TABLE_NAME = @tableName 
    AND COLUMN_NAME = 'Content'
)
BEGIN
    ALTER TABLE dbo.[TSMay] ADD Content NVARCHAR(MAX);
    PRINT 'Đã thêm cột Content vào bảng ' + @tableName;
END
ELSE
BEGIN
    PRINT 'Cột Content đã tồn tại trong bảng ' + @tableName;
END

-- Kiểm tra và thêm cột VectorJson nếu chưa có
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
    AND TABLE_NAME = @tableName 
    AND COLUMN_NAME = 'VectorJson'
)
BEGIN
    ALTER TABLE dbo.[TSMay] ADD VectorJson NVARCHAR(MAX) NULL;
    PRINT 'Đã thêm cột VectorJson vào bảng ' + @tableName;
END
ELSE
BEGIN
    PRINT 'Cột VectorJson đã tồn tại trong bảng ' + @tableName;
END

-- Kiểm tra và thêm cột Embedding (VECTOR) nếu chưa có (cho SQL Server 2025+)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo' 
    AND TABLE_NAME = @tableName 
    AND COLUMN_NAME = 'Embedding'
)
BEGIN
    -- Chỉ thêm nếu SQL Server 2025+
    IF CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) >= '16.0'
    BEGIN
        ALTER TABLE dbo.[TSMay] ADD Embedding VECTOR(384) NULL;
        PRINT 'Đã thêm cột Embedding (VECTOR) vào bảng ' + @tableName;
    END
    ELSE
    BEGIN
        PRINT 'SQL Server version không hỗ trợ VECTOR type. Bỏ qua cột Embedding.';
    END
END
ELSE
BEGIN
    PRINT 'Cột Embedding đã tồn tại trong bảng ' + @tableName;
END

-- Hiển thị cấu trúc bảng sau khi fix
PRINT '';
PRINT 'Cấu trúc bảng sau khi fix:';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' 
AND TABLE_NAME = @tableName
ORDER BY ORDINAL_POSITION;
