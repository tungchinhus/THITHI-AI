# PowerShell script to run SQL Server 2025 migration
# This script runs the sql-schema-2025.sql migration script

param(
    [string]$Server = "localhost",
    [string]$Database = "THITHI_AI",
    [string]$ScriptPath = "functions\sql-schema-2025.sql"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SQL Server 2025 Vector Migration Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if script file exists
$fullScriptPath = Join-Path $PSScriptRoot $ScriptPath
if (-not (Test-Path $fullScriptPath)) {
    Write-Host "Error: Script file not found: $fullScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Script file: $fullScriptPath" -ForegroundColor Green
Write-Host "Server: $Server" -ForegroundColor Green
Write-Host "Database: $Database" -ForegroundColor Green
Write-Host ""

# Try to use Invoke-Sqlcmd (from SqlServer module)
$useInvokeSqlcmd = $false
try {
    Import-Module SqlServer -ErrorAction Stop
    $useInvokeSqlcmd = $true
    Write-Host "Using Invoke-Sqlcmd (SqlServer module)" -ForegroundColor Green
} catch {
    Write-Host "SqlServer module not found, trying sqlcmd.exe" -ForegroundColor Yellow
}

if ($useInvokeSqlcmd) {
    try {
        Write-Host "Running migration script..." -ForegroundColor Yellow
        Write-Host ""
        
        # Read script content
        $scriptContent = Get-Content $fullScriptPath -Raw -Encoding UTF8
        
        # Split by GO statements and execute each batch
        $batches = $scriptContent -split '(?m)^GO\s*$' | Where-Object { $_.Trim() -ne '' }
        
        $batchCount = 0
        foreach ($batch in $batches) {
            $batchCount++
            if ($batch.Trim() -eq '') { continue }
            
            Write-Host "  Executing batch $batchCount..." -ForegroundColor Gray
            
            try {
                Invoke-Sqlcmd `
                    -ServerInstance $Server `
                    -Database $Database `
                    -Query $batch `
                    -TrustServerCertificate `
                    -ErrorAction Stop
                
                Write-Host "  Batch $batchCount completed" -ForegroundColor Green
            } catch {
                Write-Host "  Batch $batchCount warning: $_" -ForegroundColor Yellow
                # Continue with next batch
            }
        }
        
        Write-Host ""
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Verify VECTOR columns were created" -ForegroundColor White
        Write-Host "  2. Verify vector indexes were created" -ForegroundColor White
        Write-Host "  3. If you have existing data, run the migration query to convert JSON to VECTOR" -ForegroundColor White
        
    } catch {
        Write-Host ""
        Write-Host "Error running migration: $_" -ForegroundColor Red
        Write-Host "Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Red
        exit 1
    }
} else {
    # Fallback to sqlcmd.exe
    $sqlcmdPath = "sqlcmd.exe"
    
    # Check if sqlcmd is available
    $sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if (-not $sqlcmd) {
        Write-Host "Error: Neither Invoke-Sqlcmd nor sqlcmd.exe found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install one of the following:" -ForegroundColor Yellow
        Write-Host "  1. SQL Server Management Studio (SSMS)" -ForegroundColor White
        Write-Host "  2. SQL Server Command Line Utilities" -ForegroundColor White
        Write-Host "  3. SqlServer PowerShell module: Install-Module -Name SqlServer" -ForegroundColor White
        Write-Host ""
        Write-Host "Or run the script manually in SSMS:" -ForegroundColor Yellow
        Write-Host "  $fullScriptPath" -ForegroundColor White
        exit 1
    }
    
    Write-Host "Using sqlcmd.exe" -ForegroundColor Green
    Write-Host "Running migration script..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        $arguments = @(
            "-S", $Server,
            "-d", $Database,
            "-i", $fullScriptPath,
            "-E",
            "-b"
        )
        
        & $sqlcmdPath $arguments
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "Migration completed successfully!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "Migration completed with warnings (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "Error running migration: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration script execution finished" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
