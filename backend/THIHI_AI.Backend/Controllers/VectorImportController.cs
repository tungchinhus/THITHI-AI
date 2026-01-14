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
    /// <returns></returns>
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ImportExcel(
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

            // Kiểm tra định dạng file
            var allowedExtensions = new[] { ".xlsx", ".xls" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest(new { error = "Chỉ chấp nhận file Excel (.xlsx, .xls)" });
            }

            _logger.LogInformation("Nhận file: {FileName}, Size: {Size} bytes, Table: {TableName}", 
                file.FileName, file.Length, tableName);

            // Xử lý file
            using var stream = file.OpenReadStream();
            await _vectorImportService.ProcessExcelImportAsync(stream, tableName, selectedColumns);

            return Ok(new 
            { 
                message = "Import thành công",
                fileName = file.FileName,
                tableName = tableName,
                columns = selectedColumns
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi import Excel file");
            return StatusCode(500, new { error = "Lỗi khi xử lý file", details = ex.Message });
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
