-- =============================================
-- Script tạo EXTERNAL MODEL cho SQL Server 2025
-- =============================================
-- Chọn một trong 3 options bên dưới và uncomment để chạy
-- =============================================

-- =============================================
-- OPTION 1: Azure OpenAI Service (Khuyến nghị)
-- =============================================
-- Yêu cầu:
-- 1. Azure subscription với OpenAI resource
-- 2. Endpoint URL (ví dụ: https://your-resource.openai.azure.com/)
-- 3. API Key từ Azure Portal
-- 
-- Cách lấy thông tin:
-- - Vào Azure Portal > OpenAI resource > Keys and Endpoint
-- - Copy "Endpoint" và "Key 1" hoặc "Key 2"
-- =============================================

/*
-- Thay YOUR_ENDPOINT và YOUR_API_KEY bằng giá trị thực tế
CREATE EXTERNAL MODEL [azure_openai_embeddings]
WITH (
    LOCATION = 'https://YOUR_ENDPOINT.openai.azure.com/',
    MODEL_TYPE = 'OPENAI',
    API_KEY = 'YOUR_API_KEY'
);

-- Test generate embeddings
SELECT 
    AI_GENERATE_EMBEDDINGS(
        'azure_openai_embeddings',
        'text-embedding-3-small',  -- Hoặc 'text-embedding-ada-002'
        'Máy Bơm - Model X - Công suất 5HP'
    ) AS EmbeddingVector;

PRINT 'EXTERNAL MODEL [azure_openai_embeddings] đã được tạo thành công!';
*/

-- =============================================
-- OPTION 2: ONNX Model (Local)
-- =============================================
-- Yêu cầu:
-- 1. Download ONNX embedding model
-- 2. Đặt vào thư mục mà SQL Server service account có quyền đọc
-- 3. Thay đường dẫn trong LOCATION
-- 
-- Cách download ONNX model:
-- - Từ Hugging Face: https://huggingface.co/models?search=onnx+embedding
-- - Hoặc convert từ PyTorch/TensorFlow sang ONNX
-- =============================================

/*
-- Thay C:\Models\embedding_model.onnx bằng đường dẫn thực tế
CREATE EXTERNAL MODEL [local_onnx_embeddings]
WITH (
    LOCATION = 'C:\Models\embedding_model.onnx',
    MODEL_TYPE = 'ONNX'
);

-- Test generate embeddings
SELECT 
    AI_GENERATE_EMBEDDINGS(
        'local_onnx_embeddings',
        NULL,  -- ONNX model không cần model name
        'Máy Bơm - Model X - Công suất 5HP'
    ) AS EmbeddingVector;

PRINT 'EXTERNAL MODEL [local_onnx_embeddings] đã được tạo thành công!';
*/

-- =============================================
-- OPTION 3: REST Endpoint (Python API)
-- =============================================
-- Yêu cầu:
-- 1. Python API server đang chạy tại http://localhost:5005
-- 2. Endpoint /vectorize phải trả về format: {"vectors": [[...], ...]}
-- 
-- Lưu ý: Option này vẫn cần Python API, nhưng gọi từ SQL Server
-- =============================================

/*
CREATE EXTERNAL MODEL [python_api_embeddings]
WITH (
    LOCATION = 'http://localhost:5005/vectorize',
    MODEL_TYPE = 'REST'
);

-- Test generate embeddings
SELECT 
    AI_GENERATE_EMBEDDINGS(
        'python_api_embeddings',
        NULL,
        'Máy Bơm - Model X - Công suất 5HP'
    ) AS EmbeddingVector;

PRINT 'EXTERNAL MODEL [python_api_embeddings] đã được tạo thành công!';
*/

-- =============================================
-- Kiểm tra EXTERNAL MODEL đã tạo
-- =============================================
SELECT 
    name AS ModelName,
    location AS Location,
    model_type AS ModelType,
    created_date AS CreatedDate
FROM sys.external_models;

-- =============================================
-- Xóa EXTERNAL MODEL (nếu cần)
-- =============================================
/*
DROP EXTERNAL MODEL [azure_openai_embeddings];
-- hoặc
DROP EXTERNAL MODEL [local_onnx_embeddings];
-- hoặc
DROP EXTERNAL MODEL [python_api_embeddings];
*/

-- =============================================
-- Test với nhiều texts
-- =============================================
/*
DECLARE @texts TABLE (Id INT IDENTITY(1,1), Text NVARCHAR(MAX));
INSERT INTO @texts (Text) VALUES
    ('Máy Bơm - Model X - Công suất 5HP'),
    ('Máy Nén - Model Y - Công suất 10HP'),
    ('Máy Phát Điện - Model Z - Công suất 20HP');

SELECT 
    t.Id,
    t.Text,
    AI_GENERATE_EMBEDDINGS('azure_openai_embeddings', 'text-embedding-3-small', t.Text) AS EmbeddingVector
FROM @texts t;
*/
