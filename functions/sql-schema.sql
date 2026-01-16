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

-- ============================================
-- Chat Memory Schema for Deep Memory & Context-Aware Suggestions
-- ============================================

-- Create ChatSessions table
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
        
        -- Indexes
        INDEX IX_ChatSessions_UserId (UserId),
        INDEX IX_ChatSessions_LastActivityAt (LastActivityAt),
        INDEX IX_ChatSessions_IsActive (IsActive)
    );
END
GO

-- Create ChatMemory table with vector embeddings
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatMemory')
BEGIN
    CREATE TABLE ChatMemory (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId NVARCHAR(255) NOT NULL,
        SessionId UNIQUEIDENTIFIER NULL,
        
        -- Content fields
        [Content] NVARCHAR(MAX) NOT NULL, -- Chat message content (user or assistant)
        VectorData NVARCHAR(MAX) NULL, -- Vector embedding as JSON array
        ContentType NVARCHAR(50) NOT NULL, -- 'user' or 'assistant'
        Metadata NVARCHAR(MAX) NULL, -- Additional metadata as JSON
        
        -- Timestamps
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign key to ChatSessions
        CONSTRAINT FK_ChatMemory_SessionId FOREIGN KEY (SessionId) 
            REFERENCES ChatSessions(SessionId) ON DELETE CASCADE,
        
        -- Indexes
        INDEX IX_ChatMemory_UserId (UserId),
        INDEX IX_ChatMemory_SessionId (SessionId),
        INDEX IX_ChatMemory_ContentType (ContentType),
        INDEX IX_ChatMemory_CreatedAt (CreatedAt)
    );
END
GO

-- Stored procedure: Create or update chat session
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_upsert_chat_session')
    DROP PROCEDURE sp_upsert_chat_session;
GO

CREATE PROCEDURE sp_upsert_chat_session
    @sessionId UNIQUEIDENTIFIER = NULL,
    @userId NVARCHAR(255),
    @title NVARCHAR(500) = NULL,
    @updateActivity BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @resultSessionId UNIQUEIDENTIFIER;
    
    -- If sessionId provided, update existing session
    IF @sessionId IS NOT NULL AND EXISTS (SELECT 1 FROM ChatSessions WHERE SessionId = @sessionId)
    BEGIN
        UPDATE ChatSessions
        SET 
            Title = ISNULL(@title, Title),
            LastActivityAt = CASE WHEN @updateActivity = 1 THEN GETDATE() ELSE LastActivityAt END,
            MessageCount = MessageCount + CASE WHEN @updateActivity = 1 THEN 1 ELSE 0 END
        WHERE SessionId = @sessionId;
        
        SET @resultSessionId = @sessionId;
    END
    ELSE
    BEGIN
        -- Create new session
        SET @resultSessionId = NEWID();
        
        INSERT INTO ChatSessions (SessionId, UserId, Title, StartedAt, LastActivityAt, MessageCount, IsActive)
        VALUES (@resultSessionId, @userId, @title, GETDATE(), GETDATE(), 1, 1);
    END
    
    SELECT @resultSessionId AS SessionId;
END
GO

-- Stored procedure: Insert chat memory with vector embedding
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_insert_chat_memory')
    DROP PROCEDURE sp_insert_chat_memory;
GO

CREATE PROCEDURE sp_insert_chat_memory
    @userId NVARCHAR(255),
    @sessionId UNIQUEIDENTIFIER = NULL,
    @content NVARCHAR(MAX),
    @vectorData NVARCHAR(MAX) = NULL,
    @contentType NVARCHAR(50),
    @metadata NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO ChatMemory (UserId, SessionId, [Content], VectorData, ContentType, Metadata, CreatedAt, UpdatedAt)
    VALUES (@userId, @sessionId, @content, @vectorData, @contentType, @metadata, GETDATE(), GETDATE());
    
    SELECT SCOPE_IDENTITY() AS Id;
END
GO

-- Stored procedure: Search chat memory with vector similarity
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_search_chat_memory_vector')
    DROP PROCEDURE sp_search_chat_memory_vector;
GO

CREATE PROCEDURE sp_search_chat_memory_vector
    @userId NVARCHAR(255),
    @queryVectorJson NVARCHAR(MAX),
    @similarityThreshold FLOAT = 0.3,
    @topN INT = 10,
    @sessionId UNIQUEIDENTIFIER = NULL,
    @contentType NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get candidate records (similarity will be calculated in Node.js)
    SELECT TOP (@topN)
        Id,
        UserId,
        SessionId,
        [Content],
        VectorData,
        ContentType,
        Metadata,
        CreatedAt,
        UpdatedAt
    FROM ChatMemory
    WHERE 
        UserId = @userId
        AND VectorData IS NOT NULL
        AND (@sessionId IS NULL OR SessionId = @sessionId)
        AND (@contentType IS NULL OR ContentType = @contentType)
    ORDER BY CreatedAt DESC;
END
GO

-- Stored procedure: Get recent chat memory for context
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'sp_get_recent_chat_memory')
    DROP PROCEDURE sp_get_recent_chat_memory;
GO

CREATE PROCEDURE sp_get_recent_chat_memory
    @userId NVARCHAR(255),
    @topN INT = 50,
    @sessionId UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@topN)
        Id,
        UserId,
        SessionId,
        [Content],
        ContentType,
        Metadata,
        CreatedAt
    FROM ChatMemory
    WHERE 
        UserId = @userId
        AND (@sessionId IS NULL OR SessionId = @sessionId)
    ORDER BY CreatedAt DESC;
END
GO