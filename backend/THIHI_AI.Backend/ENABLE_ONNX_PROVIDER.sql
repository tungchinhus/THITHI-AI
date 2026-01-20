-- =============================================
-- Script bật ONNX Provider cho SQL Server 2025
-- =============================================
-- Cần chạy script này TRƯỚC KHI tạo EXTERNAL MODEL
-- =============================================

PRINT '========================================';
PRINT 'Bật ONNX Provider cho SQL Server 2025';
PRINT '========================================';
PRINT '';

-- =============================================
-- Bước 1: Kiểm tra SQL Server version
-- =============================================
PRINT 'Bước 1: Kiểm tra SQL Server version...';
SELECT 
    @@VERSION AS SqlServerVersion,
    SERVERPROPERTY('ProductVersion') AS ProductVersion,
    SERVERPROPERTY('ProductLevel') AS ProductLevel;
GO

-- =============================================
-- Bước 2: Bật External AI Runtimes
-- =============================================
PRINT '';
PRINT 'Bước 2: Bật External AI Runtimes...';
GO

-- Kiểm tra xem đã bật chưa (query từ sys.configurations)
DECLARE @aiRuntimesEnabled INT;
SELECT @aiRuntimesEnabled = CAST(value AS INT)
FROM sys.configurations
WHERE name = 'external AI runtimes enabled';

IF @aiRuntimesEnabled = 0
BEGIN
    EXEC sp_configure 'external AI runtimes enabled', 1;
    RECONFIGURE WITH OVERRIDE;
    PRINT '✅ Đã bật External AI Runtimes';
END
ELSE
BEGIN
    PRINT '✅ External AI Runtimes đã được bật';
END
GO

-- =============================================
-- Bước 3: Bật Preview Features
-- =============================================
PRINT '';
PRINT 'Bước 3: Bật Preview Features...';
GO

ALTER DATABASE SCOPED CONFIGURATION SET PREVIEW_FEATURES = ON;
PRINT '✅ Đã bật Preview Features';
GO

-- =============================================
-- Bước 4: Kiểm tra cấu hình
-- =============================================
PRINT '';
PRINT 'Bước 4: Kiểm tra cấu hình...';
GO

-- Kiểm tra External AI Runtimes
DECLARE @configValue INT;
SELECT @configValue = CAST(value AS INT)
FROM sys.configurations
WHERE name = 'external AI runtimes enabled';
PRINT 'External AI Runtimes enabled: ' + CAST(@configValue AS VARCHAR(10));

-- Kiểm tra Preview Features
DECLARE @previewFeatures NVARCHAR(MAX);
SELECT @previewFeatures = CAST(value AS NVARCHAR(MAX))
FROM sys.database_scoped_configurations 
WHERE name = 'PREVIEW_FEATURES';
PRINT 'Preview Features: ' + ISNULL(@previewFeatures, 'NULL');
GO

PRINT '';
PRINT '========================================';
PRINT '✅ HOÀN TẤT!';
PRINT '========================================';
PRINT 'Bây giờ bạn có thể tạo EXTERNAL MODEL với ONNX';
PRINT 'Chạy script CREATE_ONNX_MODEL.sql';
PRINT '========================================';
GO
