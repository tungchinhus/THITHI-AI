# Enable VECTOR support in SQL Server 2025

param(
    [string]$Server = "localhost",
    [string]$Database = "THITHI_AI"
)

Write-Host "Enabling VECTOR support in SQL Server 2025..." -ForegroundColor Cyan
Write-Host ""

$enableVectorQuery = @"
-- Check if VECTOR type exists
IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR')
BEGIN
    PRINT 'VECTOR type not found. This may require:';
    PRINT '1. SQL Server 2025 with latest updates';
    PRINT '2. Enable VECTOR feature (if available)';
    PRINT '3. Check SQL Server installation';
    
    -- Try to check feature availability
    SELECT 
        feature_name,
        feature_id,
        parent_feature_id
    FROM sys.dm_db_persisted_sku_features
    WHERE feature_name LIKE '%VECTOR%' OR feature_name LIKE '%AI%';
END
ELSE
BEGIN
    PRINT 'VECTOR type already exists!';
    SELECT name, system_type_id FROM sys.types WHERE name = 'VECTOR';
END
"@

try {
    $sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($sqlcmd) {
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
        $enableVectorQuery | Out-File $tempFile -Encoding UTF8
        
        Write-Host "Checking VECTOR type availability..." -ForegroundColor Yellow
        
        $arguments = @(
            "-S", $Server,
            "-d", $Database,
            "-i", $tempFile,
            "-E"
        )
        
        & sqlcmd.exe $arguments
        
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        
        Write-Host ""
        Write-Host "Note: If VECTOR type is not available, you may need to:" -ForegroundColor Yellow
        Write-Host "  1. Update SQL Server 2025 to the latest version" -ForegroundColor White
        Write-Host "  2. Install SQL Server 2025 with AI/ML features enabled" -ForegroundColor White
        Write-Host "  3. Use Azure SQL Database which has VECTOR support" -ForegroundColor White
        Write-Host ""
        Write-Host "For now, the code will fallback to JSON mode automatically." -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
