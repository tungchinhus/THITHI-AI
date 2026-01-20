using Microsoft.AspNetCore.Mvc;
using THIHI_AI.Backend.Services;

namespace THIHI_AI.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VectorImportController : ControllerBase
{
    private readonly VectorImportService _vectorImportService;
    private readonly ILogger<VectorImportController> _logger;

    public VectorImportController(VectorImportService vectorImportService, ILogger<VectorImportController> logger)
    {
        _vectorImportService = vectorImportService;
        _logger = logger;
    }

    /// <summary>
    /// Import Excel file và vectorize dữ liệu
    /// </summary>
    /// <param name="file">Excel file (.xlsx, .xls)</param>
    /// <param name="tableName">Tên bảng SQL để lưu dữ liệu</param>
    /// <param name="selectedColumns">Danh sách các cột cần xử lý (từ header Excel)</param>
    /// <param name="columnsForCalculation">Danh sách các cột cần chuẩn hóa cho tính toán (SUM, AVG, etc.)</param>
    /// <param name="columnsForVectorization">Danh sách các cột cần vectorize (tạo embedding)</param>
    /// <returns></returns>
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ImportExcel(
        [FromForm] IFormFile file,
        [FromForm] string tableName,
        [FromForm] List<string> selectedColumns,
        [FromForm] List<string>? columnsForCalculation = null,
        [FromForm] List<string>? columnsForVectorization = null)
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

            if (selectedColumns == null || !selectedColumns.Any())
            {
                return BadRequest(new { error = "Phải chọn ít nhất một cột" });
            }

            // Kiểm tra định dạng file
            var allowedExtensions = new[] { ".xlsx", ".xls" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest(new { error = "Chỉ chấp nhận file Excel (.xlsx, .xls)" });
            }

            _logger.LogInformation("Nhận file: {FileName}, Size: {Size} bytes, Table: {TableName}, Columns: {Columns}", 
                file.FileName, file.Length, tableName, string.Join(", ", selectedColumns));
            
            if (columnsForCalculation != null && columnsForCalculation.Any())
            {
                _logger.LogInformation("Cột chuẩn hóa cho tính toán: {Columns}", string.Join(", ", columnsForCalculation));
            }
            
            if (columnsForVectorization != null && columnsForVectorization.Any())
            {
                _logger.LogInformation("Cột vectorize: {Columns}", string.Join(", ", columnsForVectorization));
            }

            // Xử lý file
            using var stream = file.OpenReadStream();
            await _vectorImportService.ProcessExcelImportAsync(
                stream, 
                tableName, 
                selectedColumns,
                columnsForCalculation ?? new List<string>(),
                columnsForVectorization ?? new List<string>());

            _logger.LogInformation("Import thành công: {FileName} vào bảng {TableName}", file.FileName, tableName);

            return Ok(new 
            { 
                message = "Import thành công",
                fileName = file.FileName,
                tableName = tableName,
                columns = selectedColumns
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Lỗi validation khi import Excel file");
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Lỗi tham số khi import Excel file");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi import Excel file: {Message}", ex.Message);
            
            // Trả về thông báo lỗi chi tiết hơn
            var errorMessage = "Lỗi khi xử lý file";
            if (ex.InnerException != null)
            {
                errorMessage += $": {ex.InnerException.Message}";
            }
            else
            {
                errorMessage += $": {ex.Message}";
            }
            
            return StatusCode(500, new { error = errorMessage, details = ex.ToString() });
        }
    }

    /// <summary>
    /// Re-import Content từ Excel file (chỉ update Content, không vectorize lại)
    /// Dùng để fix các records đã có VectorJson nhưng Content rỗng
    /// </summary>
    [HttpPost("reimport-content")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ReimportContent(
        [FromForm] IFormFile file,
        [FromForm] string tableName,
        [FromForm] List<string> selectedColumns)
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

            if (selectedColumns == null || !selectedColumns.Any())
            {
                return BadRequest(new { error = "Phải chọn ít nhất một cột" });
            }

            var allowedExtensions = new[] { ".xlsx", ".xls" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest(new { error = "Chỉ chấp nhận file Excel (.xlsx, .xls)" });
            }

            _logger.LogInformation("Re-import Content từ file: {FileName}, Table: {TableName}", 
                file.FileName, tableName);

            using var stream = file.OpenReadStream();
            var updatedCount = await _vectorImportService.ReimportContentAsync(stream, tableName, selectedColumns);

            return Ok(new
            {
                message = "Đã cập nhật Content thành công",
                updatedCount = updatedCount,
                fileName = file.FileName,
                tableName = tableName
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi re-import Content");
            return StatusCode(500, new { error = "Lỗi khi cập nhật Content", details = ex.Message });
        }
    }

    /// <summary>
    /// Test endpoint để kiểm tra service hoạt động
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "OK", service = "VectorImportService" });
    }
}

