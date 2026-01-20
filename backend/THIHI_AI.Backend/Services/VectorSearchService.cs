using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

namespace THIHI_AI.Backend.Services;

public class VectorSearchService
{
    private readonly string _connectionString;
    private readonly HttpClient _httpClient;
    private readonly string _pythonApiUrl;
    private readonly ILogger<VectorSearchService> _logger;

    public VectorSearchService(
        Microsoft.Extensions.Configuration.IConfiguration config, 
        HttpClient httpClient, 
        ILogger<VectorSearchService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection") 
            ?? throw new ArgumentNullException(nameof(config), "DefaultConnection string is required");
        _httpClient = httpClient;
        _pythonApiUrl = config["PythonApi:VectorizeUrl"] ?? "http://localhost:5005/vectorize";
        _logger = logger;
    }

    /// <summary>
    /// Tìm kiếm với vector similarity
    /// </summary>
    /// <param name="query">Câu hỏi của user</param>
    /// <param name="tableName">Tên bảng cần search</param>
    /// <param name="topN">Số lượng kết quả trả về (mặc định 10)</param>
    /// <param name="similarityThreshold">Ngưỡng similarity tối thiểu (0-1, mặc định 0.3)</param>
    /// <returns>Danh sách kết quả với similarity score</returns>
    public async Task<List<SearchResult>> SearchAsync(
        string query, 
        string tableName, 
        int topN = 10, 
        double similarityThreshold = 0.3)
    {
        _logger.LogInformation("Bắt đầu search: Query='{Query}', Table='{TableName}', TopN={TopN}, Threshold={Threshold}",
            query, tableName, topN, similarityThreshold);

        // Bước 0: Thử tìm kiếm chính xác theo mã (keyword search) trước
        // Ví dụ: TBKT 22240T, số máy T00015298, v.v.
        var exactMatches = await GetExactMatchesAsync(query, tableName, topN);

        if (exactMatches.Count > 0)
        {
            _logger.LogInformation("Tìm thấy {Count} kết quả bằng keyword search, trả về luôn mà không cần vector search", exactMatches.Count);
            return exactMatches;
        }

        // Bước 1: Vectorize query
        var queryVector = await VectorizeTextAsync(query);
        if (queryVector == null || queryVector.Count == 0)
        {
            _logger.LogWarning("Không thể vectorize query");
            return new List<SearchResult>();
        }

        // Bước 2: Kiểm tra xem có hỗ trợ VECTOR type (SQL Server 2025+) không
        bool useNativeVector = await CheckVectorSupportAsync(tableName);
        
        List<SearchResult> topResults;
        
        if (useNativeVector)
        {
            // SQL Server 2025+: Sử dụng native VECTOR_DISTANCE function
            topResults = await SearchWithNativeVectorAsync(queryVector, tableName, topN, similarityThreshold);
        }
        else
        {
            // SQL Server 2022 hoặc cũ hơn: Tính toán trong application
            var allVectors = await GetAllVectorsFromTableAsync(tableName);

            // Bước 3: Tính cosine similarity và sắp xếp
            var results = new List<SearchResult>();
            foreach (var item in allVectors)
            {
                var similarity = CalculateCosineSimilarity(queryVector, item.Vector);
                if (similarity >= similarityThreshold)
                {
                    results.Add(new SearchResult
                    {
                        Content = item.Content,
                        Similarity = similarity,
                        Id = item.Id
                    });
                }
            }

            // Sắp xếp theo similarity giảm dần và lấy topN
            topResults = results
                .OrderByDescending(r => r.Similarity)
                .Take(topN)
                .ToList();
        }

        _logger.LogInformation("Tìm thấy {Count} kết quả với similarity >= {Threshold}", topResults.Count, similarityThreshold);

        return topResults;
    }

    /// <summary>
    /// Kiểm tra xem SQL Server có hỗ trợ VECTOR type không (SQL Server 2025+)
    /// </summary>
    private async Task<bool> CheckVectorSupportAsync(string tableName)
    {
        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        if (string.IsNullOrWhiteSpace(safeTableName))
        {
            return false;
        }

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Check SQL Server version and if VECTOR column exists
        string checkSql = $@"
            SELECT 
                CASE 
                    WHEN CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) >= '16.0' 
                         AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.[{safeTableName}]') AND name = 'Embedding')
                    THEN 1 
                    ELSE 0 
                END AS HasVectorSupport";

        using var cmd = new SqlCommand(checkSql, conn);
        var result = await cmd.ExecuteScalarAsync();
        return result != null && Convert.ToInt32(result) == 1;
    }

    /// <summary>
    /// Tìm kiếm sử dụng native VECTOR_DISTANCE function (SQL Server 2025+)
    /// </summary>
    private async Task<List<SearchResult>> SearchWithNativeVectorAsync(
        List<float> queryVector, 
        string tableName, 
        int topN, 
        double similarityThreshold)
    {
        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        if (string.IsNullOrWhiteSpace(safeTableName))
        {
            return new List<SearchResult>();
        }

        // Convert query vector to string format for SQL Server
        string vectorString = "[" + string.Join(",", queryVector.Select(v => v.ToString("R", System.Globalization.CultureInfo.InvariantCulture))) + "]";

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Use native VECTOR_DISTANCE function
        // VECTOR_DISTANCE returns distance (0 = identical), so similarity = 1 - distance
        string sql = $@"
            SELECT TOP (@topN)
                ID,
                Content,
                (1.0 - VECTOR_DISTANCE(Embedding, CAST(@queryVector AS VECTOR(384)), COSINE)) AS Similarity
            FROM dbo.[{safeTableName}]
            WHERE Embedding IS NOT NULL
              AND (1.0 - VECTOR_DISTANCE(Embedding, CAST(@queryVector AS VECTOR(384)), COSINE)) >= @threshold
            ORDER BY VECTOR_DISTANCE(Embedding, CAST(@queryVector AS VECTOR(384)), COSINE) ASC";

        var results = new List<SearchResult>();
        using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@queryVector", vectorString);
        cmd.Parameters.AddWithValue("@topN", topN);
        cmd.Parameters.AddWithValue("@threshold", similarityThreshold);

        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(new SearchResult
            {
                Id = reader.GetInt32(0),
                Content = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                Similarity = reader.GetDouble(2)
            });
        }

        _logger.LogInformation("Tìm thấy {Count} kết quả sử dụng native VECTOR search", results.Count);
        return results;
    }

    /// <summary>
    /// Keyword search: tìm chính xác theo mã (TBKT, số máy, LSX, v.v.)
    /// Khi user nhập các mã như 22240T, T00015298... vector search có thể không bắt được,
    /// nên ta ưu tiên tìm trực tiếp trong Content trước.
    /// </summary>
    private async Task<List<SearchResult>> GetExactMatchesAsync(string query, string tableName, int topN)
    {
        // Trích xuất các token có thể là mã (chứa số, có thể có chữ cái ở cuối như 22240T)
        // Hoặc date format (01/02/2021, 01-02-2021, etc.)
        var tokens = new List<string>();
        var words = query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        
        foreach (var word in words)
        {
            // Skip common words
            if (word.Length < 3) continue;
            
            // Pattern 1: Date format (01/02/2021, 01-02-2021, 01.02.2021)
            var datePattern = @"\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}";
            var dateMatch = System.Text.RegularExpressions.Regex.Match(word, datePattern);
            if (dateMatch.Success)
            {
                tokens.Add(word);
                continue;
            }
            
            // Pattern 2: Code với số + chữ cái (22240T, 20113B) - ít nhất 4 ký tự
            if (word.Length >= 4 && word.Any(char.IsDigit))
            {
                var hasDigit = word.Any(char.IsDigit);
                var hasLetter = word.Any(char.IsLetter);
                
                // Nếu có chữ cái, phải ở cuối (ví dụ: 22240T, không phải T22240)
                if (hasLetter)
                {
                    var lastChar = word[word.Length - 1];
                    var hasLetterAtEnd = char.IsLetter(lastChar);
                    var digitsBefore = word.Substring(0, word.Length - 1).All(char.IsDigit);
                    if (hasLetterAtEnd && digitsBefore && word.Length >= 5)
                    {
                        tokens.Add(word);
                        continue;
                    }
                }
                // Chỉ số: ít nhất 5 chữ số
                else if (word.Length >= 5 && word.All(char.IsDigit))
                {
                    tokens.Add(word);
                    continue;
                }
            }
        }
        
        tokens = tokens.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        if (tokens.Count == 0)
        {
            return new List<SearchResult>();
        }

        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        if (string.IsNullOrWhiteSpace(safeTableName))
        {
            return new List<SearchResult>();
        }

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Xây dựng WHERE ... LIKE cho từng token
        var whereClauses = new List<string>();
        var cmd = new SqlCommand();
        cmd.Connection = conn;

        for (int i = 0; i < tokens.Count; i++)
        {
            var paramName = $"@p{i}";
            whereClauses.Add($"Content LIKE {paramName}");
            cmd.Parameters.AddWithValue(paramName, $"%{tokens[i]}%");
        }

        string whereSql = string.Join(" OR ", whereClauses);

        // Also search in column F (TBKT) if it exists
        string checkColumnFSql = $@"
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'dbo' 
            AND TABLE_NAME = '{safeTableName}' 
            AND COLUMN_NAME = 'F'";
        
        using var checkCmd = new SqlCommand(checkColumnFSql, conn);
        var hasColumnF = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;

        if (hasColumnF)
        {
            // Add search in column F (TBKT) as well
            for (int i = 0; i < tokens.Count; i++)
            {
                var paramName = $"@f{i}";
                whereClauses.Add($"[F] LIKE {paramName}");
                cmd.Parameters.AddWithValue(paramName, $"%{tokens[i]}%");
            }
            whereSql = string.Join(" OR ", whereClauses);
        }

        // For count queries ("có bao nhiêu"), we need to get ALL matches, not just topN
        // But we still limit to a reasonable number to avoid performance issues
        var isCountQuery = query.ToLowerInvariant().Contains("có bao nhiêu") || 
                          query.ToLowerInvariant().Contains("how many") ||
                          query.ToLowerInvariant().Contains("count");
        
        var limitN = isCountQuery ? 1000 : topN; // Allow up to 1000 for count queries
        
        cmd.CommandText = $@"
            SELECT TOP (@topN) ID, Content, VectorJson
            FROM dbo.[{safeTableName}]
            WHERE {whereSql}";
        cmd.Parameters.AddWithValue("@topN", limitN);

        var results = new List<SearchResult>();
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var id = reader.GetInt32(0);
            var content = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);

            results.Add(new SearchResult
            {
                Id = id,
                Content = content,
                // Cho điểm similarity cao vì đây là match chính xác theo keyword
                Similarity = 0.99
            });
        }

        return results;
    }

    /// <summary>
    /// Vectorize text bằng Python API
    /// </summary>
    private async Task<List<float>> VectorizeTextAsync(string text)
    {
        try
        {
            var payload = new { texts = new[] { text } };
            var jsonPayload = JsonSerializer.Serialize(payload);
            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(_pythonApiUrl, content);
            response.EnsureSuccessStatusCode();

            var responseString = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseString);

            if (doc.RootElement.TryGetProperty("vectors", out var vectorsElement))
            {
                var firstVector = vectorsElement.EnumerateArray().FirstOrDefault();
                if (firstVector.ValueKind == JsonValueKind.Array)
                {
                    return firstVector.EnumerateArray().Select(x => x.GetSingle()).ToList();
                }
            }

            _logger.LogError("Python API không trả về vector hợp lệ");
            return new List<float>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi vectorize text: {Text}", text);
            return new List<float>();
        }
    }

    /// <summary>
    /// Lấy tất cả vectors từ bảng
    /// </summary>
    private async Task<List<VectorItem>> GetAllVectorsFromTableAsync(string tableName)
    {
        // Sanitize tên bảng
        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());

        if (string.IsNullOrWhiteSpace(safeTableName))
        {
            throw new ArgumentException("Tên bảng không hợp lệ", nameof(tableName));
        }

        var results = new List<VectorItem>();

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        string sql = $@"
            SELECT ID, Content, VectorJson 
            FROM dbo.[{safeTableName}]
            WHERE VectorJson IS NOT NULL";

        using var cmd = new SqlCommand(sql, conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            try
            {
                var id = reader.GetInt32(0);
                var content = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
                var vectorJson = reader.IsDBNull(2) ? null : reader.GetString(2);

                if (!string.IsNullOrEmpty(vectorJson))
                {
                    var vector = JsonSerializer.Deserialize<List<float>>(vectorJson);
                    if (vector != null && vector.Count > 0)
                    {
                        results.Add(new VectorItem
                        {
                            Id = id,
                            Content = content,
                            Vector = vector
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Lỗi khi đọc vector từ database, ID: {Id}", reader.GetInt32(0));
            }
        }

        _logger.LogInformation("Đã load {Count} vectors từ bảng {TableName}", results.Count, safeTableName);
        return results;
    }

    /// <summary>
    /// Tính cosine similarity giữa 2 vectors
    /// </summary>
    private double CalculateCosineSimilarity(List<float> vector1, List<float> vector2)
    {
        if (vector1.Count != vector2.Count)
        {
            _logger.LogWarning("Vectors có độ dài khác nhau: {Count1} vs {Count2}", vector1.Count, vector2.Count);
            return 0.0;
        }

        double dotProduct = 0.0;
        double magnitude1 = 0.0;
        double magnitude2 = 0.0;

        for (int i = 0; i < vector1.Count; i++)
        {
            dotProduct += vector1[i] * vector2[i];
            magnitude1 += vector1[i] * vector1[i];
            magnitude2 += vector2[i] * vector2[i];
        }

        magnitude1 = Math.Sqrt(magnitude1);
        magnitude2 = Math.Sqrt(magnitude2);

        if (magnitude1 == 0.0 || magnitude2 == 0.0)
        {
            return 0.0;
        }

        return dotProduct / (magnitude1 * magnitude2);
    }
}

/// <summary>
/// Kết quả tìm kiếm
/// </summary>
public class SearchResult
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public double Similarity { get; set; }
}

/// <summary>
/// Vector item từ database
/// </summary>
internal class VectorItem
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public List<float> Vector { get; set; } = new();
}
