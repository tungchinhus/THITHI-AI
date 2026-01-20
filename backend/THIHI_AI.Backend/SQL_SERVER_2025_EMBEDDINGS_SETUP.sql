-- =============================================
-- SQL Server 2025 Native Embedding Generation Setup
-- =============================================
-- Hướng dẫn: Tạo EXTERNAL MODEL để sử dụng AI_GENERATE_EMBEDDINGS
-- =============================================

-- OPTION 1: Sử dụng Azure OpenAI Service
-- Cần có Azure OpenAI endpoint và API key
/*
CREATE EXTERNAL MODEL [azure_openai_embeddings]
WITH (
    LOCATION = 'https://YOUR_OPENAI_ENDPOINT.openai.azure.com/',
    MODEL_TYPE = 'OPENAI',
    API_KEY = 'YOUR_API_KEY'
);

-- Test generate embeddings
SELECT 
    AI_GENERATE_EMBEDDINGS(
        'azure_openai_embeddings',
        'text-embedding-3-small',
        'Máy Bơm - Model X - Công suất 5HP'
    ) AS EmbeddingVector;
*/

-- OPTION 2: Sử dụng ONNX Model (Local)
-- Cần download ONNX model và đặt vào thư mục SQL Server có thể truy cập
/*
CREATE EXTERNAL MODEL [local_onnx_embeddings]
WITH (
    LOCATION = 'C:\Models\embedding_model.onnx',
    MODEL_TYPE = 'ONNX'
);

-- Test generate embeddings
SELECT 
    AI_GENERATE_EMBEDDINGS(
        'local_onnx_embeddings',
        NULL,
        'Máy Bơm - Model X - Công suất 5HP'
    ) AS EmbeddingVector;
*/

-- OPTION 3: Sử dụng REST Endpoint (Custom Python API hoặc service khác)
-- Nếu vẫn muốn dùng Python API nhưng gọi từ SQL Server
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
*/

-- =============================================
-- Kiểm tra các EXTERNAL MODEL đã tạo
-- =============================================
SELECT 
    name,
    location,
    model_type,
    created_date
FROM sys.external_models;

-- =============================================
-- Ví dụ: Generate embeddings cho nhiều texts cùng lúc
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

-- =============================================
-- Lưu ý:
-- 1. Nếu dùng Azure OpenAI, cần có Azure subscription và OpenAI resource
-- 2. Nếu dùng ONNX, cần download model và đặt vào thư mục SQL Server có thể truy cập
-- 3. Nếu dùng REST endpoint, endpoint phải trả về format mà SQL Server 2025 mong đợi
-- 4. Dimension của embedding phải khớp với VECTOR(384) hoặc VECTOR(1536) tùy model
-- =============================================
