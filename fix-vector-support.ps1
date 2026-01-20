# Fix VECTOR support by setting compatibility level to 180 (SQL Server 2025)

param(
    [string]$Server = "localhost",
    [string]$Database = "THITHI_AI"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fixing VECTOR Support" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Set compatibility level to 180
$setCompatibilityQuery = @"
-- Set database compatibility level to 180 (SQL Server 2025)
USE master;
GO

ALTER DATABASE [$Database] SET COMPATIBILITY_LEVEL = 180;
GO

USE [$Database];
GO

-- Verify compatibility level
SELECT 
    name,
    compatibility_level,
    CASE 
        WHEN compatibility_level = 180 THEN 'OK - SQL Server 2025'
        ELSE 'Need to set to 180'
    END AS Status
FROM sys.databases 
WHERE name = '$Database';
GO
"@

# Step 2: Test VECTOR type
$testVectorQuery = @"
USE [$Database];
GO

-- Test if we can create a VECTOR column
IF OBJECT_ID('tempdb..#test_vector') IS NOT NULL
    DROP TABLE #test_vector;
GO

CREATE TABLE #test_vector (
    id INT IDENTITY(1,1) PRIMARY KEY,
    test_vector VECTOR(384) NULL
);
GO

-- Test inserting a vector
DECLARE @testVec VECTOR(384) = CAST('[0.1,0.2,0.3]' AS VECTOR(384));
INSERT INTO #test_vector (test_vector) VALUES (@testVec);
GO

-- Test VECTOR_DISTANCE function
DECLARE @vec1 VECTOR(384) = CAST('[0.1,0.2,0.3]' AS VECTOR(384));
DECLARE @vec2 VECTOR(384) = CAST('[0.2,0.3,0.4]' AS VECTOR(384));
SELECT VECTOR_DISTANCE(@vec1, @vec2, COSINE) AS CosineDistance;
GO

DROP TABLE #test_vector;
GO

PRINT 'VECTOR type test completed successfully!';
GO
"@

try {
    $sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if (-not $sqlcmd) {
        Write-Host "Error: sqlcmd.exe not found!" -ForegroundColor Red
        exit 1
    }

    Write-Host "Step 1: Setting compatibility level to 180..." -ForegroundColor Yellow
    Write-Host ""
    
    $tempFile1 = [System.IO.Path]::GetTempFileName() + ".sql"
    $setCompatibilityQuery | Out-File $tempFile1 -Encoding UTF8
    
    $arguments1 = @(
        "-S", $Server,
        "-i", $tempFile1,
        "-E"
    )
    
    $result1 = & sqlcmd.exe $arguments1 2>&1
    $result1 | ForEach-Object {
        if ($_ -match 'OK|Need|compatibility_level') {
            Write-Host $_ -ForegroundColor $(if ($_ -match 'OK') { 'Green' } else { 'Yellow' })
        } elseif ($_ -match 'Msg') {
            Write-Host $_ -ForegroundColor Red
        }
    }
    
    Remove-Item $tempFile1 -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "Step 2: Testing VECTOR type functionality..." -ForegroundColor Yellow
    Write-Host ""
    
    $tempFile2 = [System.IO.Path]::GetTempFileName() + ".sql"
    $testVectorQuery | Out-File $tempFile2 -Encoding UTF8
    
    $arguments2 = @(
        "-S", $Server,
        "-d", $Database,
        "-i", $tempFile2,
        "-E"
    )
    
    $result2 = & sqlcmd.exe $arguments2 2>&1
    $testSuccess = $true
    $result2 | ForEach-Object {
        if ($_ -match 'completed successfully') {
            Write-Host $_ -ForegroundColor Green
        } elseif ($_ -match 'Msg.*[0-9]+') {
            Write-Host $_ -ForegroundColor Red
            $testSuccess = $false
        } elseif ($_ -match 'CosineDistance') {
            Write-Host "  Test result: $_" -ForegroundColor Cyan
        }
    }
    
    Remove-Item $tempFile2 -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    
    if ($testSuccess) {
        Write-Host "✅ VECTOR support is now enabled!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Run migration script again:" -ForegroundColor White
        Write-Host "     .\run-sql-migration.ps1" -ForegroundColor Gray
        Write-Host "  2. Verify VECTOR columns were created" -ForegroundColor White
        Write-Host "  3. Test vector search functionality" -ForegroundColor White
    } else {
        Write-Host "⚠️  Some tests failed. Please check the errors above." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Possible issues:" -ForegroundColor Yellow
        Write-Host "  - SQL Server 2025 CU may not include VECTOR support" -ForegroundColor White
        Write-Host "  - May need to enable specific features" -ForegroundColor White
        Write-Host "  - Check SQL Server logs for more details" -ForegroundColor White
    }
    
    Write-Host "========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
