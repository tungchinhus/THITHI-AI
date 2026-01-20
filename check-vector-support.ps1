# Detailed check for VECTOR type support in SQL Server 2025

param(
    [string]$Server = "localhost",
    [string]$Database = "THITHI_AI"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VECTOR Type Support Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$checkQueries = @"
-- 1. Check SQL Server version
SELECT 
    'SQL Server Version' AS CheckItem,
    CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) AS Value,
    CASE 
        WHEN CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) >= '17.0.0' THEN 'OK'
        ELSE 'Need SQL Server 2025'
    END AS Status
UNION ALL
-- 2. Check database compatibility level
SELECT 
    'Database Compatibility Level' AS CheckItem,
    CAST(compatibility_level AS VARCHAR(10)) AS Value,
    CASE 
        WHEN compatibility_level >= 180 THEN 'OK (180 = SQL Server 2025)'
        ELSE 'Need to set to 180'
    END AS Status
FROM sys.databases WHERE name = DB_NAME()
UNION ALL
-- 3. Check if VECTOR type exists
SELECT 
    'VECTOR Type Exists' AS CheckItem,
    CASE WHEN EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR') 
        THEN 'YES' 
        ELSE 'NO' 
    END AS Value,
    CASE WHEN EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR') 
        THEN 'OK'
        ELSE 'NOT FOUND'
    END AS Status
UNION ALL
-- 4. Check VECTOR type details if exists
SELECT 
    'VECTOR Type Details' AS CheckItem,
    CASE WHEN EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR')
        THEN (SELECT CAST(system_type_id AS VARCHAR(10)) + ' - ' + name FROM sys.types WHERE name = 'VECTOR')
        ELSE 'N/A'
    END AS Value,
    CASE WHEN EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR')
        THEN 'OK'
        ELSE 'N/A'
    END AS Status
UNION ALL
-- 5. Check if we can create a test VECTOR column
SELECT 
    'Can Create VECTOR Column' AS CheckItem,
    CASE 
        WHEN EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR') THEN 'Should work'
        ELSE 'Cannot test - VECTOR type not found'
    END AS Value,
    CASE 
        WHEN EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR') THEN 'OK'
        ELSE 'BLOCKED'
    END AS Status
"@

$detailedCheck = @"
-- Detailed system information
SELECT 
    'Product Version' AS Info,
    CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) AS Value
UNION ALL
SELECT 
    'Product Level',
    CAST(SERVERPROPERTY('ProductLevel') AS VARCHAR(50))
UNION ALL
SELECT 
    'Edition',
    CAST(SERVERPROPERTY('Edition') AS VARCHAR(100))
UNION ALL
SELECT 
    'Engine Edition',
    CAST(SERVERPROPERTY('EngineEdition') AS VARCHAR(50))
UNION ALL
SELECT 
    'IsClustered',
    CAST(SERVERPROPERTY('IsClustered') AS VARCHAR(10))
UNION ALL
SELECT 
    'IsAdvancedAnalyticsEnabled',
    CAST(SERVERPROPERTY('IsAdvancedAnalyticsEnabled') AS VARCHAR(10))
"@

$checkTypes = @"
-- Check all system types
SELECT 
    name,
    system_type_id,
    user_type_id,
    is_table_type,
    is_assembly_type
FROM sys.types
WHERE name LIKE '%VECTOR%' OR name LIKE '%vector%'
ORDER BY name
"@

try {
    $sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if (-not $sqlcmd) {
        Write-Host "Error: sqlcmd.exe not found!" -ForegroundColor Red
        Write-Host "Please install SQL Server Command Line Utilities" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "1. Running basic checks..." -ForegroundColor Yellow
    Write-Host ""
    
    $tempFile1 = [System.IO.Path]::GetTempFileName() + ".sql"
    $checkQueries | Out-File $tempFile1 -Encoding UTF8
    
    $arguments1 = @(
        "-S", $Server,
        "-d", $Database,
        "-i", $tempFile1,
        "-E",
        "-W", "-s", ","
    )
    
    $result1 = & sqlcmd.exe $arguments1 2>&1
    $result1 | Where-Object { $_ -notmatch '^Msg|^\([0-9]' } | ForEach-Object {
        if ($_ -match 'CheckItem|OK|NOT FOUND|BLOCKED|Need') {
            $parts = $_ -split ','
            if ($parts.Count -ge 3) {
                $item = $parts[0].Trim()
                $value = $parts[1].Trim()
                $status = $parts[2].Trim()
                
                $color = if ($status -like '*OK*') { 'Green' } 
                         elseif ($status -like '*NOT FOUND*' -or $status -like '*BLOCKED*') { 'Red' }
                         else { 'Yellow' }
                
                Write-Host "  $item : $value" -ForegroundColor $color
                Write-Host "    Status: $status" -ForegroundColor $color
            } else {
                Write-Host $_ -ForegroundColor Gray
            }
        }
    }
    
    Remove-Item $tempFile1 -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "2. Checking system information..." -ForegroundColor Yellow
    Write-Host ""
    
    $tempFile2 = [System.IO.Path]::GetTempFileName() + ".sql"
    $detailedCheck | Out-File $tempFile2 -Encoding UTF8
    
    $arguments2 = @(
        "-S", $Server,
        "-d", $Database,
        "-i", $tempFile2,
        "-E",
        "-W", "-s", ","
    )
    
    $result2 = & sqlcmd.exe $arguments2 2>&1
    $result2 | Where-Object { $_ -notmatch '^Msg|^\([0-9]' } | ForEach-Object {
        if ($_ -match 'Info|Product|Edition|Analytics') {
            $parts = $_ -split ','
            if ($parts.Count -ge 2) {
                $info = $parts[0].Trim()
                $value = $parts[1].Trim()
                Write-Host "  $info : $value" -ForegroundColor Cyan
            }
        }
    }
    
    Remove-Item $tempFile2 -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "3. Checking for VECTOR-related types..." -ForegroundColor Yellow
    Write-Host ""
    
    $tempFile3 = [System.IO.Path]::GetTempFileName() + ".sql"
    $checkTypes | Out-File $tempFile3 -Encoding UTF8
    
    $arguments3 = @(
        "-S", $Server,
        "-d", $Database,
        "-i", $tempFile3,
        "-E",
        "-W", "-s", ","
    )
    
    $result3 = & sqlcmd.exe $arguments3 2>&1
    $vectorTypesFound = $false
    $result3 | Where-Object { $_ -notmatch '^Msg|^\([0-9]' } | ForEach-Object {
        if ($_ -match 'VECTOR|vector') {
            $vectorTypesFound = $true
            Write-Host "  $_" -ForegroundColor Green
        }
    }
    
    if (-not $vectorTypesFound) {
        Write-Host "  No VECTOR types found in sys.types" -ForegroundColor Red
    }
    
    Remove-Item $tempFile3 -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Summary and Recommendations" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
