-- =============================================
-- Script Debug Lỗi ONNX Model
-- =============================================
-- Lỗi: "Cannot continue the execution because the session is in the kill state"
-- Nguyên nhân thường gặp: ONNX model không thể load được
-- =============================================

PRINT '========================================';
PRINT 'Debug ONNX Model Error';
PRINT '========================================';
PRINT '';

-- =============================================
-- Bước 1: Kiểm tra EXTERNAL MODEL
-- =============================================
PRINT 'Bước 1: Kiểm tra EXTERNAL MODEL...';
SELECT 
    name AS ModelName,
    location AS Location
FROM sys.external_models
WHERE name = 'local_onnx_embeddings';
GO

-- =============================================
-- Bước 2: Kiểm tra file ONNX có tồn tại không
-- =============================================
PRINT '';
PRINT 'Bước 2: Kiểm tra file ONNX...';
PRINT 'File path: C:\SQLServerModels\embedding_model.onnx';
PRINT 'Vui lòng kiểm tra thủ công:';
PRINT '1. File có tồn tại không?';
PRINT '2. SQL Server service account có quyền đọc file không?';
PRINT '3. File có bị corrupted không?';
GO

-- =============================================
-- Bước 3: Kiểm tra ONNX Runtime (nếu cần)
-- =============================================
PRINT '';
PRINT 'Bước 3: Kiểm tra ONNX Runtime...';
PRINT 'Nếu SQL Server yêu cầu ONNX Runtime DLLs:';
PRINT '1. Download ONNX Runtime từ: https://github.com/microsoft/onnxruntime/releases';
PRINT '2. Extract onnxruntime.dll vào: C:\onnx_runtime\';
PRINT '3. Update CREATE EXTERNAL MODEL với LOCAL_RUNTIME_PATH';
GO

-- =============================================
-- Bước 4: Test đơn giản (không dùng biến)
-- =============================================
PRINT '';
PRINT 'Bước 4: Test đơn giản (không dùng biến)...';
PRINT 'Thử query này:';
PRINT 'SELECT CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS(''Test'' USE MODEL local_onnx_embeddings)) AS Embedding;';
GO

-- =============================================
-- Bước 5: Kiểm tra SQL Server Error Log
-- =============================================
PRINT '';
PRINT 'Bước 5: Kiểm tra SQL Server Error Log...';
PRINT 'Xem SQL Server Error Log để biết lỗi chi tiết:';
PRINT '1. SQL Server Management Studio > Management > SQL Server Logs';
PRINT '2. Xem log mới nhất để tìm lỗi liên quan đến ONNX';
GO

PRINT '';
PRINT '========================================';
PRINT 'Debug hoàn tất';
PRINT '========================================';
GO
