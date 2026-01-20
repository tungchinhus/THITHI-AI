-- =============================================
-- Script tạo EXTERNAL MODEL với LOCAL_RUNTIME_PATH
-- =============================================
-- Nếu CREATE_ONNX_MODEL.sql bị lỗi "kill state", thử script này
-- =============================================

PRINT '========================================';
PRINT 'Tạo EXTERNAL MODEL với ONNX Runtime';
PRINT '========================================';
PRINT '';

-- =============================================
-- Bước 1: Xóa model cũ nếu có
-- =============================================
IF EXISTS (SELECT 1 FROM sys.external_models WHERE name = 'local_onnx_embeddings')
BEGIN
    DROP EXTERNAL MODEL [local_onnx_embeddings];
    PRINT 'Đã xóa EXTERNAL MODEL cũ: local_onnx_embeddings';
END
GO

-- =============================================
-- Bước 2: Tạo EXTERNAL MODEL với LOCAL_RUNTIME_PATH
-- =============================================
-- Lưu ý: Cần download ONNX Runtime DLLs trước
-- 1. Download từ: https://github.com/microsoft/onnxruntime/releases
-- 2. Extract onnxruntime.dll vào: C:\onnx_runtime\
-- 3. Set permissions: icacls "C:\onnx_runtime" /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)R" /T

PRINT 'Tạo EXTERNAL MODEL với LOCAL_RUNTIME_PATH...';
PRINT 'Đảm bảo đã download ONNX Runtime DLLs vào C:\onnx_runtime\';
PRINT '';

-- Option 1: Với LOCAL_RUNTIME_PATH (nếu SQL Server yêu cầu)
CREATE EXTERNAL MODEL [local_onnx_embeddings]
WITH (
    LOCATION = 'C:\SQLServerModels\embedding_model.onnx',
    API_FORMAT = 'ONNX Runtime',
    MODEL_TYPE = EMBEDDINGS,
    MODEL = 'embedding_model',
    LOCAL_RUNTIME_PATH = 'C:\onnx_runtime\'  -- Thư mục chứa onnxruntime.dll
);
GO

PRINT '✅ Đã tạo EXTERNAL MODEL với LOCAL_RUNTIME_PATH';
PRINT '';

-- =============================================
-- Bước 3: Test đơn giản
-- =============================================
PRINT 'Test AI_GENERATE_EMBEDDINGS...';
PRINT '';

-- Test đơn giản (không dùng biến để tránh lỗi)
SELECT 
    'Test' AS TestText,
    CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS('Test' USE MODEL local_onnx_embeddings)) AS EmbeddingJson;
GO

PRINT '';
PRINT '========================================';
PRINT 'Hoàn tất!';
PRINT '========================================';
GO
