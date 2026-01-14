-- SQL Server Schema for TSMay with Vector Embeddings
-- Compatible with SQL Server 2022+ and Azure SQL Database

-- Create database if not exists (run this manually in SQL Server Management Studio)
-- CREATE DATABASE THITHI_AI;
-- GO
-- USE THITHI_AI;
-- GO

-- Enable CLR if needed for vector operations (SQL Server 2025+)
-- For SQL Server 2022, we'll use JSON to store vectors
-- EXEC sp_configure 'clr enabled', 1;
-- RECONFIGURE;
-- GO

-- Create TSMay table with vector support
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TSMay')
BEGIN
    CREATE TABLE TSMay (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DocumentId NVARCHAR(255) UNIQUE NOT NULL, -- Firestore document ID
        
        -- Original data fields (dynamic columns stored as JSON)
        DataJson NVARCHAR(MAX) NOT NULL, -- Store all Excel columns as JSON
        
        -- Vector embedding (stored as JSON array for SQL Server 2022)
        -- For SQL Server 2025+, can use VECTOR type: Embedding VECTOR(768)
        EmbeddingJson NVARCHAR(MAX) NULL, -- JSON array of floats [0.1, 0.2, ...]
        
        -- Metadata
        ImportedAt DATETIME2 DEFAULT GETDATE(),
        RowIndex INT NULL,
        OriginalColumns NVARCHAR(MAX) NULL, -- JSON array of column names
        
        -- Indexes
        INDEX IX_TSMay_DocumentId (DocumentId),
        INDEX IX_TSMay_ImportedAt (ImportedAt)
    );
    
    -- Full-text search index for text fields in JSON
    -- CREATE FULLTEXT INDEX ON TSMay(DataJson) KEY INDEX PK_TSMay;
END
GO

-- Function to calculate cosine similarity (for SQL Server 2022)
-- Note: SQL Server 2025+ has built-in VECTOR_DISTANCE function
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'fn_cosine_similarity')
    DROP FUNCTION fn_cosine_similarity;
GO

CREATE FUNCTION fn_cosine_similarity(@vec1Json NVARCHAR(MAX), @vec2Json NVARCHAR(MAX))
RETURNS FLOAT
AS
BEGIN
    DECLARE @similarity FLOAT = 0.0;
    DECLARE @dotProduct FLOAT = 0.0;
    DECLARE @norm1 FLOAT = 0.0;
    DECLARE @norm2 FLOAT = 0.0;
    
    -- Parse JSON arrays
    DECLARE @vec1 TABLE (idx INT, val FLOAT);
    DECLARE @vec2 TABLE (idx INT, val FLOAT);
    
    -- Insert vector values (simplified - in production, use proper JSON parsing)
    -- This is a placeholder - actual implementation would parse JSON properly
    
    -- For now, return 0 (will be calculated in Node.js)
    RETURN @similarity;
END
GO

-- Stored procedure to search with vector similarity
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_search_tsmay_vector')
    DROP PROCEDURE sp_search_tsmay_vector;
GO

CREATE PROCEDURE sp_search_tsmay_vector
    @queryEmbeddingJson NVARCHAR(MAX),
    @similarityThreshold FLOAT = 0.3,
    @topN INT = 10,
    @filterField NVARCHAR(255) = NULL,
    @filterValue NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- For SQL Server 2022, we'll return all records and calculate similarity in Node.js
    -- For SQL Server 2025+, can use VECTOR_DISTANCE function directly
    
    SELECT TOP (@topN)
        Id,
        DocumentId,
        DataJson,
        EmbeddingJson,
        ImportedAt,
        RowIndex,
        OriginalColumns
    FROM TSMay
    WHERE 
        (@filterField IS NULL OR JSON_VALUE(DataJson, CONCAT('$."', @filterField, '"')) = @filterValue)
        AND EmbeddingJson IS NOT NULL
    ORDER BY ImportedAt DESC;
END
GO

-- Stored procedure to insert/update TSMay record
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_upsert_tsmay')
    DROP PROCEDURE sp_upsert_tsmay;
GO

CREATE PROCEDURE sp_upsert_tsmay
    @documentId NVARCHAR(255),
    @dataJson NVARCHAR(MAX),
    @embeddingJson NVARCHAR(MAX) = NULL,
    @rowIndex INT = NULL,
    @originalColumns NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM TSMay WHERE DocumentId = @documentId)
    BEGIN
        UPDATE TSMay
        SET 
            DataJson = @dataJson,
            EmbeddingJson = @embeddingJson,
            RowIndex = @rowIndex,
            OriginalColumns = @originalColumns
        WHERE DocumentId = @documentId;
    END
    ELSE
    BEGIN
        INSERT INTO TSMay (DocumentId, DataJson, EmbeddingJson, RowIndex, OriginalColumns)
        VALUES (@documentId, @dataJson, @embeddingJson, @rowIndex, @originalColumns);
    END
    
    SELECT SCOPE_IDENTITY() AS Id;
END
GO

-- Index for JSON queries (SQL Server 2016+)
-- This helps with JSON_VALUE queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TSMay_DataJson')
BEGIN
    -- Note: Can't create index directly on JSON, but can create computed column
    -- For now, we'll rely on full-text search or calculate in application
END
GO
