-- =============================================
-- Script tạo EXTERNAL MODEL với ONNX Model
-- =============================================
-- Yêu cầu:
-- 1. Đã download ONNX embedding model
-- 2. Đã đặt model vào thư mục SQL Server có thể truy cập
-- 3. SQL Server service account có quyền đọc file
-- =============================================

-- =============================================
-- BƯỚC 1: Kiểm tra SQL Server version
-- =============================================
SELECT 
    @@VERSION AS SqlServerVersion,
    SERVERPROPERTY('ProductVersion') AS ProductVersion,
    SERVERPROPERTY('ProductLevel') AS ProductLevel;

-- Phải là SQL Server 2025 (version >= 16.0) để hỗ trợ AI_GENERATE_EMBEDDINGS

-- =============================================
-- BƯỚC 1.1: Bật ONNX Provider (BẮT BUỘC)
-- =============================================
-- Cần enable ONNX provider để sử dụng AI_GENERATE_EMBEDDINGS với ONNX model
PRINT 'Bật ONNX Provider...';
GO

-- Bật external AI runtimes
EXEC sp_configure 'external AI runtimes enabled', 1;
RECONFIGURE WITH OVERRIDE;
GO

-- Bật preview features nếu cần
ALTER DATABASE SCOPED CONFIGURATION SET PREVIEW_FEATURES = ON;
GO

PRINT '✅ Đã bật ONNX Provider';
GO

-- =============================================
-- BƯỚC 2: Tạo EXTERNAL MODEL với ONNX
-- =============================================
-- Thay đường dẫn trong LOCATION bằng đường dẫn thực tế của file .onnx
-- Ví dụ: C:\SQLServerModels\embedding_model.onnx

-- Xóa model cũ nếu đã tồn tại
IF EXISTS (SELECT 1 FROM sys.external_models WHERE name = 'local_onnx_embeddings')
BEGIN
    DROP EXTERNAL MODEL [local_onnx_embeddings];
    PRINT 'Đã xóa EXTERNAL MODEL cũ: local_onnx_embeddings';
END
GO

-- Tạo EXTERNAL MODEL mới
-- Lưu ý: SQL Server 2025 yêu cầu option MODEL (tên model)
-- Nếu dùng ONNX file trực tiếp, có thể không cần LOCAL_RUNTIME_PATH
-- Nếu vẫn lỗi, thử thêm LOCAL_RUNTIME_PATH (thư mục chứa onnxruntime.dll)
CREATE EXTERNAL MODEL [local_onnx_embeddings]
WITH (
    LOCATION = 'C:\SQLServerModels\embedding_model.onnx',  -- ⚠️ THAY ĐƯỜNG DẪN NÀY
    API_FORMAT = 'ONNX Runtime',
    MODEL_TYPE = EMBEDDINGS,  -- EMBEDDINGS (không có quotes) hoặc 'ONNX'
    MODEL = 'embedding_model'  -- Tên model (có thể đặt tùy ý, bắt buộc)
    -- LOCAL_RUNTIME_PATH = 'C:\onnx_runtime\'  -- Uncomment nếu cần ONNX Runtime DLLs
);
GO

PRINT 'Đã tạo EXTERNAL MODEL: local_onnx_embeddings';
PRINT 'Location: C:\SQLServerModels\embedding_model.onnx';  -- ⚠️ THAY ĐƯỜNG DẪN NÀY
GO

-- =============================================
-- BƯỚC 3: Kiểm tra EXTERNAL MODEL đã tạo
-- =============================================
-- Lưu ý: Cấu trúc sys.external_models có thể khác nhau tùy version
SELECT 
    name AS ModelName,
    location AS Location
FROM sys.external_models
WHERE name = 'local_onnx_embeddings';

-- Nếu có các cột khác, thử query này:
-- SELECT * FROM sys.external_models WHERE name = 'local_onnx_embeddings';
GO

-- =============================================
-- BƯỚC 4: Test Generate Embeddings
-- =============================================
-- Test với một text đơn giản
PRINT 'Testing AI_GENERATE_EMBEDDINGS...';
GO

DECLARE @testText NVARCHAR(MAX) = 'Máy Bơm - Model X - Công suất 5HP';
DECLARE @embeddingResult NVARCHAR(MAX);  -- AI_GENERATE_EMBEDDINGS trả về JSON string
DECLARE @embedding VARBINARY(MAX);

BEGIN TRY
    -- Syntax đúng: AI_GENERATE_EMBEDDINGS(text USE MODEL model_name)
    -- Lưu ý: AI_GENERATE_EMBEDDINGS trả về JSON type, cần CONVERT sang NVARCHAR(MAX)
    SET @embeddingResult = CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS(@testText USE MODEL local_onnx_embeddings));
    
    -- Convert JSON string sang VARBINARY nếu cần
    IF @embeddingResult IS NOT NULL
    BEGIN
        -- Thử parse JSON và convert sang VARBINARY
        -- Nếu là JSON array, extract và convert
        SET @embedding = CAST(@embeddingResult AS VARBINARY(MAX));
        
        PRINT '✅ SUCCESS: AI_GENERATE_EMBEDDINGS hoạt động!';
        PRINT 'Embedding result length: ' + CAST(LEN(@embeddingResult) AS VARCHAR(20)) + ' characters';
        PRINT 'Embedding binary size: ' + CAST(DATALENGTH(@embedding) AS VARCHAR(20)) + ' bytes';
        
        -- Hiển thị kết quả
        SELECT 
            @testText AS TestText,
            @embeddingResult AS EmbeddingJson,  -- JSON string
            @embedding AS EmbeddingVector,      -- VARBINARY
            DATALENGTH(@embedding) AS EmbeddingSizeBytes;
    END
    ELSE
    BEGIN
        PRINT '⚠️ WARNING: AI_GENERATE_EMBEDDINGS trả về NULL';
    END
END TRY
BEGIN CATCH
    PRINT '❌ ERROR: ' + ERROR_MESSAGE();
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS VARCHAR(10));
    PRINT 'Error Line: ' + CAST(ERROR_LINE() AS VARCHAR(10));
    PRINT 'Error State: ' + CAST(ERROR_STATE() AS VARCHAR(10));
END CATCH
GO

-- =============================================
-- BƯỚC 5: Test với nhiều texts
-- =============================================
PRINT 'Testing với nhiều texts...';
GO

DECLARE @texts TABLE (Id INT IDENTITY(1,1), Text NVARCHAR(MAX));
INSERT INTO @texts (Text) VALUES
    ('Máy Bơm - Model X - Công suất 5HP'),
    ('Máy Nén - Model Y - Công suất 10HP'),
    ('Máy Phát Điện - Model Z - Công suất 20HP');

-- Lưu ý: AI_GENERATE_EMBEDDINGS trả về JSON type, cần CONVERT sang NVARCHAR(MAX)
SELECT 
    t.Id,
    t.Text,
    CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS(t.Text USE MODEL local_onnx_embeddings)) AS EmbeddingJson,
    LEN(CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS(t.Text USE MODEL local_onnx_embeddings))) AS EmbeddingSizeChars
FROM @texts t;
GO

-- =============================================
-- BƯỚC 6: Xác định dimension của embedding
-- =============================================
-- ONNX model thường có dimension cố định (384, 768, 1536, ...)
-- Cần biết dimension để cấu hình VECTOR(dimension) trong table

PRINT 'Xác định dimension của embedding...';
GO

DECLARE @testEmbeddingJson NVARCHAR(MAX);
DECLARE @dimension INT;

-- AI_GENERATE_EMBEDDINGS trả về JSON type, cần CONVERT sang NVARCHAR(MAX)
SET @testEmbeddingJson = CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS('Test' USE MODEL local_onnx_embeddings));

-- Parse dimension từ JSON array
-- AI_GENERATE_EMBEDDINGS trả về JSON array: [0.1, 0.2, 0.3, ...]
IF @testEmbeddingJson IS NOT NULL AND LEN(@testEmbeddingJson) > 0
BEGIN
    -- Đếm số phần tử trong JSON array để xác định dimension
    -- Format: [0.1,0.2,0.3,...] hoặc [0.1, 0.2, 0.3, ...]
    DECLARE @commaCount INT;
    SET @commaCount = (LEN(@testEmbeddingJson) - LEN(REPLACE(@testEmbeddingJson, ',', '')));
    
    -- Dimension = số dấu phẩy + 1
    SET @dimension = @commaCount + 1;
    
    PRINT 'Embedding JSON length: ' + CAST(LEN(@testEmbeddingJson) AS VARCHAR(10)) + ' characters';
    PRINT 'Embedding dimension (estimated): ' + CAST(@dimension AS VARCHAR(10));
    PRINT 'VECTOR type nên là: VECTOR(' + CAST(@dimension AS VARCHAR(10)) + ')';
    PRINT 'Embedding preview (first 100 chars): ' + SUBSTRING(@testEmbeddingJson, 1, 100);
END
ELSE
BEGIN
    PRINT '⚠️ Không thể xác định dimension. Embedding result là NULL hoặc rỗng.';
END
GO

-- =============================================
-- LƯU Ý QUAN TRỌNG
-- =============================================
/*
1. Đảm bảo file .onnx đã được đặt vào thư mục SQL Server có thể truy cập
2. SQL Server service account phải có quyền đọc file
3. Đường dẫn không được có khoảng trắng hoặc ký tự đặc biệt
4. Sau khi tạo EXTERNAL MODEL, cập nhật appsettings.json:
   {
     "Embedding": {
       "Type": "SQL_SERVER",
       "ModelName": "local_onnx_embeddings"
     }
   }
5. Cập nhật VECTOR dimension trong table creation script nếu cần
*/

PRINT '========================================';
PRINT 'Setup hoàn tất!';
PRINT 'Model name: local_onnx_embeddings';
PRINT '========================================';
GO
