using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Data;
using System.Text.Json;
using THIHI_AI.Backend.Services;

namespace THIHI_AI.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PdfImportController : ControllerBase
{
    private readonly PdfProcessingService _pdfProcessingService;
    private readonly VectorImportService _vectorImportService;
    private readonly ILogger<PdfImportController> _logger;
    private readonly string _connectionString;

    public PdfImportController(
        PdfProcessingService pdfProcessingService,
        VectorImportService vectorImportService,
        IConfiguration configuration,
        ILogger<PdfImportController> logger)
    {
        _pdfProcessingService = pdfProcessingService;
        _vectorImportService = vectorImportService;
        _logger = logger;
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? throw new ArgumentNullException(nameof(configuration), "DefaultConnection string is required");
    }

    /// <summary>
    /// Import PDF file và vectorize nội dung
    /// </summary>
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ImportPdf(
        [FromForm] IFormFile file,
        [FromForm] string tableName)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "File không được để trống" });
            }

            if (string.IsNullOrWhiteSpace(tableName))
            {
                return BadRequest(new { error = "Tên bảng không được để trống" });
            }

            // Kiểm tra định dạng file
            var allowedExtensions = new[] { ".pdf" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest(new { error = "Chỉ chấp nhận file PDF (.pdf)" });
            }

            _logger.LogInformation("Nhận PDF file: {FileName}, Size: {Size} bytes, Table: {TableName}", 
                file.FileName, file.Length, tableName);

            // BƯỚC 1: Trích xuất text từ PDF
            using var pdfStream = file.OpenReadStream();
            var chunks = await _pdfProcessingService.ExtractTextFromPdfAsync(pdfStream, file.FileName);

            if (chunks == null || !chunks.Any())
            {
                return BadRequest(new { error = "Không thể trích xuất text từ PDF. File có thể là scan (hình ảnh) hoặc bị lỗi." });
            }

            _logger.LogInformation("Đã trích xuất {ChunkCount} chunks từ PDF", chunks.Count);

            // BƯỚC 2: Vectorize và lưu vào database
            await ProcessPdfChunksAsync(chunks, tableName, file.FileName);

            _logger.LogInformation("Import PDF thành công: {FileName} vào bảng {TableName}", 
                file.FileName, tableName);

            return Ok(new 
            { 
                message = "Import PDF thành công",
                fileName = file.FileName,
                tableName = tableName,
                chunkCount = chunks.Count,
                totalPages = chunks.Select(c => c.PageNumber).Distinct().Count()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi import PDF file: {Message}", ex.Message);
            return StatusCode(500, new { error = "Lỗi khi xử lý PDF", details = ex.Message });
        }
    }

    /// <summary>
    /// Xử lý PDF chunks: vectorize và lưu vào database
    /// </summary>
    private async Task ProcessPdfChunksAsync(
        List<PdfChunk> chunks, 
        string tableName, 
        string fileName)
    {
        // Lấy danh sách texts để vectorize
        var texts = chunks.Select(c => c.Text).ToList();
        
        // Generate embeddings (sử dụng VectorImportService)
        List<List<float>>? vectors = null;
        try
        {
            _logger.LogInformation("Bắt đầu generate embeddings cho {Count} PDF chunks", texts.Count);
            vectors = await _vectorImportService.GenerateEmbeddingsAsync(texts);
            _logger.LogInformation("Đã generate {Count} embeddings", vectors?.Count ?? 0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi generate embeddings cho PDF chunks");
            // Tạo empty vectors để vẫn có thể lưu data
            vectors = new List<List<float>>();
            for (int i = 0; i < texts.Count; i++)
            {
                vectors.Add(new List<float>());
            }
        }

        // Lưu vào database với metadata (PageNumber, FileName, ChunkIndex)
        await SavePdfChunksToDatabaseAsync(chunks, vectors, tableName);
    }

    /// <summary>
    /// Lưu PDF chunks vào database
    /// </summary>
    private async Task SavePdfChunksToDatabaseAsync(
        List<PdfChunk> chunks,
        List<List<float>>? vectors,
        string tableName)
    {
        if (chunks.Count != (vectors?.Count ?? 0))
        {
            _logger.LogError("Số lượng chunks ({ChunkCount}) và vectors ({VectorCount}) không khớp", 
                chunks.Count, vectors?.Count ?? 0);
            throw new ArgumentException($"Số lượng chunks ({chunks.Count}) và vectors ({vectors?.Count ?? 0}) không khớp");
        }

        // Sanitize tên bảng
        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        
        if (string.IsNullOrWhiteSpace(safeTableName))
        {
            throw new ArgumentException("Tên bảng không hợp lệ", nameof(tableName));
        }

        _logger.LogInformation("Lưu {Count} PDF chunks vào bảng: {TableName}", chunks.Count, safeTableName);

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Tạo bảng nếu chưa tồn tại (với các cột cho PDF)
        string createTableSql = $@"
            IF OBJECT_ID('dbo.[{safeTableName}]', 'U') IS NULL
            BEGIN
                -- Check if SQL Server 2025+ (VECTOR type support)
                IF CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) >= '16.0'
                BEGIN
                    -- SQL Server 2025+ with native VECTOR support
                    CREATE TABLE dbo.[{safeTableName}] (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        Content NVARCHAR(MAX),
                        VectorJson NVARCHAR(MAX) NULL,
                        Embedding VECTOR(384) NULL,
                        PageNumber INT NULL,
                        FileName NVARCHAR(500) NULL,
                        ChunkIndex INT NULL,
                        DocumentType NVARCHAR(50) NULL DEFAULT 'PDF'
                    );
                END
                ELSE
                BEGIN
                    -- SQL Server 2022 or earlier - use JSON only
                    CREATE TABLE dbo.[{safeTableName}] (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        Content NVARCHAR(MAX),
                        VectorJson NVARCHAR(MAX) NULL,
                        PageNumber INT NULL,
                        FileName NVARCHAR(500) NULL,
                        ChunkIndex INT NULL,
                        DocumentType NVARCHAR(50) NULL DEFAULT 'PDF'
                    );
                END
            END";

        using (var cmd = new SqlCommand(createTableSql, conn))
        {
            await cmd.ExecuteNonQueryAsync();
            _logger.LogInformation("Đã tạo/kiểm tra bảng: {TableName}", safeTableName);
        }

        // Đảm bảo các cột PDF metadata tồn tại (nếu bảng đã tồn tại)
        string ensureColumnsSql = $@"
            IF COL_LENGTH('dbo.[{safeTableName}]', 'PageNumber') IS NULL
                ALTER TABLE dbo.[{safeTableName}] ADD PageNumber INT NULL;
            IF COL_LENGTH('dbo.[{safeTableName}]', 'FileName') IS NULL
                ALTER TABLE dbo.[{safeTableName}] ADD FileName NVARCHAR(500) NULL;
            IF COL_LENGTH('dbo.[{safeTableName}]', 'ChunkIndex') IS NULL
                ALTER TABLE dbo.[{safeTableName}] ADD ChunkIndex INT NULL;
            IF COL_LENGTH('dbo.[{safeTableName}]', 'DocumentType') IS NULL
                ALTER TABLE dbo.[{safeTableName}] ADD DocumentType NVARCHAR(50) NULL DEFAULT 'PDF';
            IF COL_LENGTH('dbo.[{safeTableName}]', 'Content') IS NULL
                ALTER TABLE dbo.[{safeTableName}] ADD Content NVARCHAR(MAX) NULL;
            IF COL_LENGTH('dbo.[{safeTableName}]', 'VectorJson') IS NULL
                ALTER TABLE dbo.[{safeTableName}] ADD VectorJson NVARCHAR(MAX) NULL;";

        using (var cmd = new SqlCommand(ensureColumnsSql, conn))
        {
            await cmd.ExecuteNonQueryAsync();
        }

        // Kiểm tra xem có cột Embedding (VECTOR) không
        bool hasVectorColumn = false;
        string checkVectorColumnSql = $@"
            SELECT COUNT(*) 
            FROM sys.columns 
            WHERE object_id = OBJECT_ID('dbo.[{safeTableName}]') 
            AND name = 'Embedding'";
        
        using (var checkCmd = new SqlCommand(checkVectorColumnSql, conn))
        {
            var result = await checkCmd.ExecuteScalarAsync();
            hasVectorColumn = result != null && Convert.ToInt32(result) > 0;
        }

        // Chuẩn bị INSERT statement
        var columnNames = new List<string> { "Content", "VectorJson", "PageNumber", "FileName", "ChunkIndex", "DocumentType" };
        if (hasVectorColumn)
        {
            columnNames.Insert(2, "Embedding"); // Insert sau VectorJson
        }

        string columnsSql = string.Join(", ", columnNames.Select(c => $"[{c}]"));
        string valuesSql = string.Join(", ", columnNames.Select(c => 
            c == "Embedding" ? "CAST(@Embedding AS VECTOR(384))" : $"@{c}"));
        string insertSqlTemplate = $"INSERT INTO dbo.[{safeTableName}] ({columnsSql}) VALUES ({valuesSql})";

        // Insert dữ liệu
        using var transaction = conn.BeginTransaction();
        try
        {
            int insertedCount = 0;

            for (int i = 0; i < chunks.Count; i++)
            {
                var chunk = chunks[i];
                var vector = vectors?[i] ?? new List<float>();

                if (string.IsNullOrWhiteSpace(chunk.Text))
                {
                    _logger.LogWarning("Bỏ qua chunk có Content rỗng (index={Index})", i);
                    continue;
                }

                // Xử lý vector
                string? vectorJson = null;
                string? vectorString = null;
                
                if (vector != null && vector.Count > 0)
                {
                    try
                    {
                        vectorJson = JsonSerializer.Serialize(vector);
                        
                        if (hasVectorColumn)
                        {
                            vectorString = "[" + string.Join(",", vector.Select(v => v.ToString("R", System.Globalization.CultureInfo.InvariantCulture))) + "]";
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Lỗi khi serialize vector cho chunk {Index}", i);
                    }
                }

                using var cmd = new SqlCommand(insertSqlTemplate, conn, transaction);
                cmd.Parameters.AddWithValue("@Content", chunk.Text.Trim());
                cmd.Parameters.AddWithValue("@VectorJson", vectorJson ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@PageNumber", chunk.PageNumber);
                cmd.Parameters.AddWithValue("@FileName", chunk.FileName);
                cmd.Parameters.AddWithValue("@ChunkIndex", chunk.ChunkIndex);
                cmd.Parameters.AddWithValue("@DocumentType", "PDF");
                
                if (hasVectorColumn)
                {
                    if (!string.IsNullOrEmpty(vectorString))
                    {
                        cmd.Parameters.Add(new SqlParameter("@Embedding", SqlDbType.NVarChar)
                        {
                            Value = vectorString
                        });
                    }
                    else
                    {
                        cmd.Parameters.AddWithValue("@Embedding", DBNull.Value);
                    }
                }

                try
                {
                    await cmd.ExecuteNonQueryAsync();
                    insertedCount++;
                    
                    if ((i + 1) % 50 == 0)
                    {
                        _logger.LogInformation("Đã insert {Count}/{Total} PDF chunks", insertedCount, chunks.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi insert PDF chunk {Index}", i);
                    throw;
                }
            }
            
            transaction.Commit();
            _logger.LogInformation("Đã insert {Count} PDF chunks vào bảng {TableName}", insertedCount, safeTableName);
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "Lỗi khi insert PDF chunks. Đã rollback transaction");
            throw;
        }
    }

    /// <summary>
    /// Test endpoint để kiểm tra trích xuất PDF (không lưu vào database)
    /// </summary>
    [HttpPost("test-extract")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> TestExtract([FromForm] IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "File không được để trống" });
            }

            var allowedExtensions = new[] { ".pdf" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest(new { error = "Chỉ chấp nhận file PDF (.pdf)" });
            }

            using var stream = file.OpenReadStream();
            var chunks = await _pdfProcessingService.ExtractTextFromPdfAsync(stream, file.FileName);
            
            return Ok(new 
            { 
                chunkCount = chunks.Count,
                totalPages = chunks.Select(c => c.PageNumber).Distinct().Count(),
                chunks = chunks.Take(5).Select(c => new 
                {
                    text = c.Text.Substring(0, Math.Min(200, c.Text.Length)) + (c.Text.Length > 200 ? "..." : ""),
                    pageNumber = c.PageNumber,
                    chunkIndex = c.ChunkIndex,
                    metadata = c.GetMetadata()
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi test extract PDF");
            return StatusCode(500, new { error = "Lỗi khi trích xuất PDF", details = ex.Message });
        }
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "OK", service = "PdfImportService" });
    }
}
