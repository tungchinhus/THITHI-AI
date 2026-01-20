-- Set Database Compatibility Level to 180 (SQL Server 2025)
-- Run this script in SQL Server Management Studio (SSMS)
-- Requires ALTER DATABASE permission

USE master;
GO

-- Option 1: Set directly (if no active connections)
ALTER DATABASE [THITHI_AI] SET COMPATIBILITY_LEVEL = 180;
GO

-- Option 2: If database is in use, use single_user mode
/*
USE master;
GO

-- Close all connections and set to single user
ALTER DATABASE [THITHI_AI] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

-- Set compatibility level
ALTER DATABASE [THITHI_AI] SET COMPATIBILITY_LEVEL = 180;
GO

-- Set back to multi user
ALTER DATABASE [THITHI_AI] SET MULTI_USER;
GO
*/

-- Verify compatibility level
USE THITHI_AI;
GO

SELECT 
    name AS DatabaseName,
    compatibility_level,
    CASE 
        WHEN compatibility_level = 180 THEN 'OK - SQL Server 2025'
        WHEN compatibility_level = 170 THEN 'SQL Server 2022 - Need to upgrade'
        ELSE 'Older version - Need to upgrade'
    END AS Status
FROM sys.databases 
WHERE name = 'THITHI_AI';
GO

-- Test VECTOR type after setting compatibility level
IF OBJECT_ID('tempdb..#test_vector') IS NOT NULL
    DROP TABLE #test_vector;
GO

PRINT 'Testing VECTOR type...';
GO

CREATE TABLE #test_vector (
    id INT IDENTITY(1,1) PRIMARY KEY,
    test_vector VECTOR(384) NULL
);
GO

DECLARE @testVec VECTOR(384) = CAST('[0.1,0.2,0.3]' AS VECTOR(384));
INSERT INTO #test_vector (test_vector) VALUES (@testVec);
GO

DECLARE @vec1 VECTOR(384) = CAST('[0.1,0.2,0.3]' AS VECTOR(384));
DECLARE @vec2 VECTOR(384) = CAST('[0.2,0.3,0.4]' AS VECTOR(384));
SELECT 
    VECTOR_DISTANCE(@vec1, @vec2, COSINE) AS CosineDistance,
    CASE 
        WHEN VECTOR_DISTANCE(@vec1, @vec2, COSINE) IS NOT NULL THEN 'VECTOR type is working!'
        ELSE 'VECTOR type test failed'
    END AS TestResult;
GO

DROP TABLE #test_vector;
GO

PRINT 'Compatibility level setup completed!';
PRINT 'If VECTOR test passed, you can now run the migration script.';
GO
