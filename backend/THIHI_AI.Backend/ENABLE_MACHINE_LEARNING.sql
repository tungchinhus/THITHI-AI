-- =============================================
-- Script Enable Machine Learning Services
-- =============================================
-- Cần để chạy AI features trong SQL Server 2025
-- =============================================

PRINT '========================================';
PRINT 'Enable Machine Learning Services';
PRINT '========================================';
PRINT '';

-- =============================================
-- Bước 1: Kiểm tra cấu hình hiện tại
-- =============================================
PRINT 'Bước 1: Kiểm tra cấu hình hiện tại...';
GO

SELECT 
    name AS ConfigName,
    value AS CurrentValue,
    value_in_use AS ValueInUse,
    description
FROM sys.configurations
WHERE name IN (
    'external scripts enabled',
    'external AI runtimes enabled'
);
GO

-- =============================================
-- Bước 2: Enable External Scripts
-- =============================================
PRINT '';
PRINT 'Bước 2: Enable External Scripts...';
GO

DECLARE @externalScriptsEnabled INT;
SELECT @externalScriptsEnabled = CAST(value AS INT)
FROM sys.configurations
WHERE name = 'external scripts enabled';

IF @externalScriptsEnabled = 0
BEGIN
    EXEC sp_configure 'external scripts enabled', 1;
    RECONFIGURE WITH OVERRIDE;
    PRINT 'OK: External scripts enabled';
END
ELSE
BEGIN
    PRINT 'OK: External scripts already enabled';
END
GO

-- =============================================
-- Bước 3: Enable External AI Runtimes
-- =============================================
PRINT '';
PRINT 'Bước 3: Enable External AI Runtimes...';
GO

DECLARE @aiRuntimesEnabled INT;
SELECT @aiRuntimesEnabled = CAST(value AS INT)
FROM sys.configurations
WHERE name = 'external AI runtimes enabled';

IF @aiRuntimesEnabled = 0
BEGIN
    EXEC sp_configure 'external AI runtimes enabled', 1;
    RECONFIGURE WITH OVERRIDE;
    PRINT 'OK: External AI runtimes enabled';
END
ELSE
BEGIN
    PRINT 'OK: External AI runtimes already enabled';
END
GO

-- =============================================
-- Bước 4: Kiểm tra lại
-- =============================================
PRINT '';
PRINT 'Bước 4: Kiểm tra lại cấu hình...';
GO

SELECT 
    name AS ConfigName,
    value AS CurrentValue,
    value_in_use AS ValueInUse
FROM sys.configurations
WHERE name IN (
    'external scripts enabled',
    'external AI runtimes enabled'
);
GO

PRINT '';
PRINT '========================================';
PRINT 'IMPORTANT: Restart SQL Server Service!';
PRINT '========================================';
PRINT 'Sau khi enable, cần restart SQL Server service:';
PRINT '1. Stop SQL Server service';
PRINT '2. Start SQL Server service';
PRINT '3. Sau đó test lại AI_GENERATE_EMBEDDINGS';
PRINT '========================================';
GO
