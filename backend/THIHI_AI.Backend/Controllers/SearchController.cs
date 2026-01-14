using Microsoft.AspNetCore.Mvc;
using THIHI_AI.Backend.Services;

namespace THIHI_AI.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly VectorSearchService _vectorSearchService;
    private readonly ILogger<SearchController> _logger;

    public SearchController(VectorSearchService vectorSearchService, ILogger<SearchController> logger)
    {
        _vectorSearchService = vectorSearchService;
        _logger = logger;
    }

    /// <summary>
    /// Tìm kiếm với vector similarity
    /// </summary>
    /// <param name="query">Câu hỏi cần tìm kiếm</param>
    /// <param name="tableName">Tên bảng cần search (mặc định: TSMay)</param>
    /// <param name="topN">Số lượng kết quả trả về (mặc định: 10)</param>
    /// <param name="similarityThreshold">Ngưỡng similarity tối thiểu 0-1 (mặc định: 0.3)</param>
    /// <returns>Danh sách kết quả với similarity score</returns>
    [HttpPost("vector")]
    public async Task<IActionResult> VectorSearch(
        [FromBody] SearchRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest(new { error = "Query không được để trống" });
            }

            if (string.IsNullOrWhiteSpace(request.TableName))
            {
                request.TableName = "TSMay"; // Default table
            }

            _logger.LogInformation("Nhận request search: Query='{Query}', Table='{Table}', TopN={TopN}, Threshold={Threshold}",
                request.Query, request.TableName, request.TopN, request.SimilarityThreshold);

            var results = await _vectorSearchService.SearchAsync(
                request.Query,
                request.TableName,
                request.TopN,
                request.SimilarityThreshold
            );

            return Ok(new SearchResponse
            {
                Query = request.Query,
                TableName = request.TableName,
                Results = results,
                TotalResults = results.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi search vector");
            return StatusCode(500, new { error = "Lỗi khi tìm kiếm", details = ex.Message });
        }
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "OK", service = "VectorSearchService" });
    }
}

/// <summary>
/// Request model cho vector search
/// </summary>
public class SearchRequest
{
    public string Query { get; set; } = string.Empty;
    public string TableName { get; set; } = "TSMay";
    public int TopN { get; set; } = 10;
    public double SimilarityThreshold { get; set; } = 0.3;
}

/// <summary>
/// Response model cho vector search
/// </summary>
public class SearchResponse
{
    public string Query { get; set; } = string.Empty;
    public string TableName { get; set; } = string.Empty;
    public int TotalResults { get; set; }
    public List<SearchResult> Results { get; set; } = new();
}
