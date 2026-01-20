-- SQL Server 2025 Schema with Native Vector Support
-- This schema uses native VECTOR data type and VECTOR_DISTANCE function
-- Requires SQL Server 2025 or later

-- ============================================
-- Migration Script: Upgrade from JSON to VECTOR
-- ============================================
-- Run this script to migrate existing tables from JSON vectors to native VECTOR type

-- Step 1: Create TSMay table if not exists, then add VECTOR column
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TSMay')
BEGIN
    -- Create table with VECTOR column from the start
    CREATE TABLE TSMay (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DocumentId NVARCHAR(255) UNIQUE NOT NULL,
        DataJson NVARCHAR(MAX) NOT NULL,
        EmbeddingJson NVARCHAR(MAX) NULL, -- Backward compatibility
        Embedding VECTOR(384) NULL, -- Native VECTOR type for SQL Server 2025+
        ImportedAt DATETIME2 DEFAULT GETDATE(),
        RowIndex INT NULL,
        OriginalColumns NVARCHAR(MAX) NULL,
        INDEX IX_TSMay_DocumentId (DocumentId),
        INDEX IX_TSMay_ImportedAt (ImportedAt)
    );
    PRINT 'Created TSMay table with VECTOR support';
END
ELSE
BEGIN
    -- Table exists, add VECTOR column if not exists
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TSMay') AND name = 'Embedding')
    BEGIN
        -- Add VECTOR column (assuming 384 dimensions - adjust based on your embedding model)
        -- Common dimensions: 384 (sentence-transformers), 768 (BERT), 1536 (OpenAI)
        ALTER TABLE TSMay ADD Embedding VECTOR(384) NULL;
        PRINT 'Added Embedding VECTOR column to TSMay table';
    END
END
GO

-- Step 2: Create ChatMemory table if not exists, then add VECTOR column
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatMemory')
BEGIN
    -- Create table with VECTOR column from the start
    CREATE TABLE ChatMemory (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId NVARCHAR(255) NOT NULL,
        SessionId UNIQUEIDENTIFIER NULL,
        [Content] NVARCHAR(MAX) NOT NULL,
        VectorData NVARCHAR(MAX) NULL, -- Backward compatibility
        Embedding VECTOR(384) NULL, -- Native VECTOR type for SQL Server 2025+
        ContentType NVARCHAR(50) NOT NULL,
        Metadata NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE(),
        INDEX IX_ChatMemory_UserId (UserId),
        INDEX IX_ChatMemory_SessionId (SessionId),
        INDEX IX_ChatMemory_ContentType (ContentType),
        INDEX IX_ChatMemory_CreatedAt (CreatedAt)
    );
    
    -- Create ChatSessions table if not exists (required for foreign key)
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatSessions')
    BEGIN
        CREATE TABLE ChatSessions (
            SessionId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
            UserId NVARCHAR(255) NOT NULL,
            Title NVARCHAR(500) NULL,
            StartedAt DATETIME2 DEFAULT GETDATE(),
            LastActivityAt DATETIME2 DEFAULT GETDATE(),
            MessageCount INT DEFAULT 0,
            IsActive BIT DEFAULT 1,
            INDEX IX_ChatSessions_UserId (UserId),
            INDEX IX_ChatSessions_LastActivityAt (LastActivityAt),
            INDEX IX_ChatSessions_IsActive (IsActive)
        );
    END
    
    -- Add foreign key if not exists
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ChatMemory_SessionId')
    BEGIN
        ALTER TABLE ChatMemory
        ADD CONSTRAINT FK_ChatMemory_SessionId 
        FOREIGN KEY (SessionId) REFERENCES ChatSessions(SessionId) ON DELETE CASCADE;
    END
    
    PRINT 'Created ChatMemory table with VECTOR support';
END
ELSE
BEGIN
    -- Table exists, add VECTOR column if not exists
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ChatMemory') AND name = 'Embedding')
    BEGIN
        ALTER TABLE ChatMemory ADD Embedding VECTOR(384) NULL;
        PRINT 'Added Embedding VECTOR column to ChatMemory table';
    END
END
GO

-- Step 3: Create vector indexes for performance (SQL Server 2025+)
-- Vector indexes use approximate nearest neighbor search (ANN)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TSMay_Embedding')
BEGIN
    CREATE VECTOR INDEX IX_TSMay_Embedding ON TSMay(Embedding)
    WITH (INDEX_TYPE = HNSW, DISTANCE_FUNCTION = COSINE);
    PRINT 'Created vector index on TSMay.Embedding';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ChatMemory_Embedding')
BEGIN
    CREATE VECTOR INDEX IX_ChatMemory_Embedding ON ChatMemory(Embedding)
    WITH (INDEX_TYPE = HNSW, DISTANCE_FUNCTION = COSINE);
    PRINT 'Created vector index on ChatMemory.Embedding';
END
GO

-- ============================================
-- Updated Stored Procedures for SQL Server 2025
-- ============================================

-- Stored procedure: Search TSMay with native VECTOR_DISTANCE
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_search_tsmay_vector')
    DROP PROCEDURE sp_search_tsmay_vector;
GO

CREATE PROCEDURE sp_search_tsmay_vector
    @queryEmbedding VECTOR(384),  -- Native VECTOR type instead of JSON
    @similarityThreshold FLOAT = 0.3,
    @topN INT = 10,
    @filterField NVARCHAR(255) = NULL,
    @filterValue NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Use native VECTOR_DISTANCE function with COSINE distance
    -- VECTOR_DISTANCE returns distance (0 = identical, higher = more different)
    -- For similarity, we use 1 - distance (since COSINE distance is 1 - cosine similarity)
    
    SELECT TOP (@topN)
        Id,
        DocumentId,
        DataJson,
        EmbeddingJson,  -- Keep for backward compatibility
        Embedding,      -- Native VECTOR column
        ImportedAt,
        RowIndex,
        OriginalColumns,
        -- Calculate similarity: 1 - COSINE distance
        (1.0 - VECTOR_DISTANCE(Embedding, @queryEmbedding, COSINE)) AS Similarity
    FROM TSMay
    WHERE 
        Embedding IS NOT NULL
        AND (@filterField IS NULL OR JSON_VALUE(DataJson, CONCAT('$."', @filterField, '"')) = @filterValue)
        -- Filter by similarity threshold
        AND (1.0 - VECTOR_DISTANCE(Embedding, @queryEmbedding, COSINE)) >= @similarityThreshold
    ORDER BY VECTOR_DISTANCE(Embedding, @queryEmbedding, COSINE) ASC;  -- Order by distance (ascending = most similar)
END
GO

-- Stored procedure: Upsert TSMay with VECTOR
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_upsert_tsmay')
    DROP PROCEDURE sp_upsert_tsmay;
GO

CREATE PROCEDURE sp_upsert_tsmay
    @documentId NVARCHAR(255),
    @dataJson NVARCHAR(MAX),
    @embedding VECTOR(384) = NULL,  -- Native VECTOR type
    @embeddingJson NVARCHAR(MAX) = NULL,  -- Keep for backward compatibility
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
            Embedding = @embedding,
            EmbeddingJson = @embeddingJson,  -- Keep for backward compatibility
            RowIndex = @rowIndex,
            OriginalColumns = @originalColumns
        WHERE DocumentId = @documentId;
    END
    ELSE
    BEGIN
        INSERT INTO TSMay (DocumentId, DataJson, Embedding, EmbeddingJson, RowIndex, OriginalColumns)
        VALUES (@documentId, @dataJson, @embedding, @embeddingJson, @rowIndex, @originalColumns);
    END
    
    SELECT SCOPE_IDENTITY() AS Id;
END
GO

-- Stored procedure: Search ChatMemory with native VECTOR_DISTANCE
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_search_chat_memory_vector')
    DROP PROCEDURE sp_search_chat_memory_vector;
GO

CREATE PROCEDURE sp_search_chat_memory_vector
    @userId NVARCHAR(255),
    @queryEmbedding VECTOR(384),  -- Native VECTOR type
    @similarityThreshold FLOAT = 0.3,
    @topN INT = 10,
    @sessionId UNIQUEIDENTIFIER = NULL,
    @contentType NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@topN)
        Id,
        UserId,
        SessionId,
        [Content],
        VectorData,  -- Keep for backward compatibility
        Embedding,   -- Native VECTOR column
        ContentType,
        Metadata,
        CreatedAt,
        UpdatedAt,
        -- Calculate similarity: 1 - COSINE distance
        (1.0 - VECTOR_DISTANCE(Embedding, @queryEmbedding, COSINE)) AS Similarity
    FROM ChatMemory
    WHERE 
        UserId = @userId
        AND Embedding IS NOT NULL
        AND (@sessionId IS NULL OR SessionId = @sessionId)
        AND (@contentType IS NULL OR ContentType = @contentType)
        -- Filter by similarity threshold
        AND (1.0 - VECTOR_DISTANCE(Embedding, @queryEmbedding, COSINE)) >= @similarityThreshold
    ORDER BY VECTOR_DISTANCE(Embedding, @queryEmbedding, COSINE) ASC;  -- Order by distance (ascending = most similar)
END
GO

-- Stored procedure: Insert ChatMemory with VECTOR
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_insert_chat_memory')
    DROP PROCEDURE sp_insert_chat_memory;
GO

CREATE PROCEDURE sp_insert_chat_memory
    @userId NVARCHAR(255),
    @sessionId UNIQUEIDENTIFIER = NULL,
    @content NVARCHAR(MAX),
    @embedding VECTOR(384) = NULL,  -- Native VECTOR type
    @vectorData NVARCHAR(MAX) = NULL,  -- Keep for backward compatibility
    @contentType NVARCHAR(50),
    @metadata NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO ChatMemory (UserId, SessionId, [Content], Embedding, VectorData, ContentType, Metadata, CreatedAt, UpdatedAt)
    VALUES (@userId, @sessionId, @content, @embedding, @vectorData, @contentType, @metadata, GETDATE(), GETDATE());
    
    SELECT SCOPE_IDENTITY() AS Id;
END
GO

-- ============================================
-- Helper Function: Convert JSON array to VECTOR
-- ============================================
-- This function helps migrate JSON vectors to native VECTOR type
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'fn_json_to_vector')
    DROP FUNCTION fn_json_to_vector;
GO

CREATE FUNCTION fn_json_to_vector(@jsonArray NVARCHAR(MAX))
RETURNS TABLE
AS
RETURN
(
    -- Parse JSON array and convert to VECTOR format
    -- Note: This is a simplified version - actual implementation may vary
    SELECT 
        CAST('[' + STRING_AGG(CAST(value AS NVARCHAR(MAX)), ',') + ']' AS NVARCHAR(MAX)) AS VectorString
    FROM OPENJSON(@jsonArray)
    WHERE ISNUMERIC(value) = 1
)
GO

-- ============================================
-- Migration Helper: Update existing records
-- ============================================
-- Run this to migrate existing JSON vectors to VECTOR type
-- Note: Adjust VECTOR dimension (384) based on your embedding model

/*
-- Example migration script (uncomment and run manually)
UPDATE TSMay
SET Embedding = CAST(EmbeddingJson AS VECTOR(384))
WHERE EmbeddingJson IS NOT NULL 
  AND Embedding IS NULL
  AND ISJSON(EmbeddingJson) = 1;

UPDATE ChatMemory
SET Embedding = CAST(VectorData AS VECTOR(384))
WHERE VectorData IS NOT NULL 
  AND Embedding IS NULL
  AND ISJSON(VectorData) = 1;
*/

PRINT 'SQL Server 2025 Vector Schema setup completed!';
PRINT 'Remember to:';
PRINT '1. Adjust VECTOR dimension (currently 384) based on your embedding model';
PRINT '2. Run migration script to convert existing JSON vectors to VECTOR type';
PRINT '3. Update application code to use VECTOR type instead of JSON';
