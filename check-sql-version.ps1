# Check SQL Server version and VECTOR support

param(
    [string]$Server = "localhost",
    [string]$Database = "THITHI_AI"
)

Write-Host "Checking SQL Server version and VECTOR support..." -ForegroundColor Cyan
Write-Host ""

$checkVersionQuery = @"
SELECT 
    SERVERPROPERTY('ProductVersion') AS ProductVersion,
    SERVERPROPERTY('ProductLevel') AS ProductLevel,
    SERVERPROPERTY('Edition') AS Edition,
    SERVERPROPERTY('EngineEdition') AS EngineEdition,
    CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) AS VersionString
"@

try {
    Import-Module SqlServer -ErrorAction Stop
    
    $result = Invoke-Sqlcmd `
        -ServerInstance $Server `
        -Database $Database `
        -Query $checkVersionQuery `
        -TrustServerCertificate
    
    $version = $result.VersionString
    $majorVersion = [int]($version.Split('.')[0])
    $minorVersion = [int]($version.Split('.')[1])
    
    Write-Host "SQL Server Version: $($result.ProductVersion)" -ForegroundColor Green
    Write-Host "Edition: $($result.Edition)" -ForegroundColor Green
    Write-Host "Product Level: $($result.ProductLevel)" -ForegroundColor Green
    Write-Host ""
    
    if ($majorVersion -ge 16) {
        Write-Host "✅ SQL Server 2025 or later detected!" -ForegroundColor Green
        Write-Host "   VECTOR type should be supported." -ForegroundColor Green
    } elseif ($majorVersion -ge 15) {
        Write-Host "⚠️  SQL Server 2019/2022 detected" -ForegroundColor Yellow
        Write-Host "   VECTOR type is NOT supported. Use JSON instead." -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  Older SQL Server version detected" -ForegroundColor Yellow
        Write-Host "   VECTOR type is NOT supported. Use JSON instead." -ForegroundColor Yellow
    }
    
    # Check if VECTOR type exists
    $checkVectorQuery = @"
    IF EXISTS (SELECT * FROM sys.types WHERE name = 'VECTOR')
        SELECT 'VECTOR type exists' AS Status
    ELSE
        SELECT 'VECTOR type NOT found' AS Status
"@
    
    $vectorCheck = Invoke-Sqlcmd `
        -ServerInstance $Server `
        -Database $Database `
        -Query $checkVectorQuery `
        -TrustServerCertificate
    
    Write-Host ""
    Write-Host "VECTOR Type Check: $($vectorCheck.Status)" -ForegroundColor $(if ($vectorCheck.Status -like '*exists*') { 'Green' } else { 'Red' })
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying with sqlcmd.exe..." -ForegroundColor Yellow
    
    $sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($sqlcmd) {
        $tempFile = [System.IO.Path]::GetTempFileName()
        $checkVersionQuery | Out-File $tempFile -Encoding UTF8
        
        $arguments = @(
            "-S", $Server,
            "-d", $Database,
            "-i", $tempFile,
            "-E",
            "-h", "-1"
        )
        
        & sqlcmd.exe $arguments
        
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}
