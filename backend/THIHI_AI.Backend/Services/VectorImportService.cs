using MiniExcelLibs;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Data;
using System.Text;
using System.Text.Json;
using System.Linq;

namespace THIHI_AI.Backend.Services;

public class VectorImportService
{
    private readonly string _connectionString;
    private readonly HttpClient _httpClient;
    private readonly string _pythonApiUrl;
    private readonly string _embeddingModelName; // SQL Server 2025 EXTERNAL MODEL name
    private readonly string _embeddingModelType; // "SQL_SERVER" (native) or "PYTHON_API" (fallback)
    private readonly ILogger<VectorImportService> _logger;

    public VectorImportService(Microsoft.Extensions.Configuration.IConfiguration config, HttpClient httpClient, ILogger<VectorImportService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection") 
            ?? throw new ArgumentNullException(nameof(config), "DefaultConnection string is required");
        _httpClient = httpClient;
        _pythonApiUrl = config["PythonApi:VectorizeUrl"] ?? "http://localhost:5005/vectorize";
        _embeddingModelName = config["Embedding:ModelName"] ?? "azure_openai_embeddings";
        _embeddingModelType = config["Embedding:Type"] ?? "SQL_SERVER"; // "SQL_SERVER" or "PYTHON_API"
        _logger = logger;
    }

    public async Task ProcessExcelImportAsync(
        Stream fileStream, 
        string tableName, 
        List<string> selectedColumns,
        List<string> columnsForCalculation = null!,
        List<string> columnsForVectorization = null!)
    {
        _logger.LogInformation("Bắt đầu xử lý import Excel. Table: {TableName}, Columns: {Columns}", 
            tableName, string.Join(", ", selectedColumns));
        
        if (columnsForCalculation != null && columnsForCalculation.Any())
        {
            _logger.LogInformation("Cột chuẩn hóa cho tính toán: {Columns}", string.Join(", ", columnsForCalculation));
        }
        
        if (columnsForVectorization != null && columnsForVectorization.Any())
        {
            _logger.LogInformation("Cột vectorize: {Columns}", string.Join(", ", columnsForVectorization));
        }

        // BƯỚC 1: Đọc và gộp dữ liệu từ Excel
        var rawData = MiniExcel.Query(fileStream).Cast<IDictionary<string, object>>().ToList();
        var processedTexts = new List<string>();
        var validRawData = new List<IDictionary<string, object>>(); // Chỉ lưu các dòng hợp lệ

        _logger.LogInformation("Đã đọc {Count} dòng raw data từ Excel", rawData.Count);
        
        // Log tên các cột có trong Excel để debug
        if (rawData.Any())
        {
            var availableColumns = rawData.First().Keys.ToList();
            _logger.LogInformation("Các cột có trong Excel ({Count}): {Columns}", availableColumns.Count, string.Join(", ", availableColumns));
            _logger.LogInformation("Các cột user chọn ({Count}): {Columns}", selectedColumns.Count, string.Join(", ", selectedColumns));
            
            // Kiểm tra match giữa selectedColumns và availableColumns
            var matchedColumns = selectedColumns.Where(sc => 
                availableColumns.Any(ac => string.Equals(ac, sc, StringComparison.OrdinalIgnoreCase))
            ).ToList();
            var unmatchedColumns = selectedColumns.Where(sc => 
                !availableColumns.Any(ac => string.Equals(ac, sc, StringComparison.OrdinalIgnoreCase))
            ).ToList();
            
            _logger.LogInformation("Các cột match ({Count}): {Columns}", matchedColumns.Count, string.Join(", ", matchedColumns));
            if (unmatchedColumns.Any())
            {
                _logger.LogWarning("Các cột không match ({Count}): {Columns}", unmatchedColumns.Count, string.Join(", ", unmatchedColumns));
            }
        }

        foreach (var row in rawData)
        {
            // Lấy giá trị các cột được chọn cho vectorization (mặc định là tất cả selectedColumns nếu không chỉ định)
            var valuesForVectorization = new List<string>();
            var columnsToUse = (columnsForVectorization != null && columnsForVectorization.Any()) 
                ? columnsForVectorization 
                : selectedColumns; // Fallback về selectedColumns nếu không chỉ định
            
            foreach (var col in columnsToUse)
            {
                // Thử tìm cột với case-insensitive
                var matchingKey = row.Keys.FirstOrDefault(k => 
                    string.Equals(k, col, StringComparison.OrdinalIgnoreCase));
                
                if (matchingKey != null && row[matchingKey] != null)
                {
                    var value = row[matchingKey].ToString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        valuesForVectorization.Add(value.Trim());
                    }
                }
            }

            // Nếu không tìm thấy giá trị từ các cột vectorization, lấy tất cả các cột đã chọn
            if (valuesForVectorization.Count == 0)
            {
                _logger.LogDebug("Không tìm thấy giá trị từ các cột vectorization, lấy tất cả các cột đã chọn");
                foreach (var col in selectedColumns)
                {
                    var matchingKey = row.Keys.FirstOrDefault(k => 
                        string.Equals(k, col, StringComparison.OrdinalIgnoreCase));
                    
                    if (matchingKey != null && row[matchingKey] != null)
                    {
                        var value = row[matchingKey].ToString();
                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            valuesForVectorization.Add(value.Trim());
                        }
                    }
                }
            }

            // Nếu vẫn không có giá trị, lấy tất cả các cột có giá trị trong row (fallback cuối cùng)
            if (valuesForVectorization.Count == 0)
            {
                _logger.LogDebug("Không tìm thấy giá trị từ selectedColumns, lấy tất cả các cột có giá trị trong row");
                foreach (var kvp in row)
                {
                    if (kvp.Value != null)
                    {
                        var value = kvp.Value.ToString();
                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            valuesForVectorization.Add(value.Trim());
                        }
                    }
                }
            }

            // Ví dụ: "Máy Bơm - Model X - Công suất 5HP"
            string combinedText = string.Join(" - ", valuesForVectorization);
            
            // Đảm bảo không lưu empty string - nhưng chỉ bỏ qua nếu row hoàn toàn trống
            if (string.IsNullOrWhiteSpace(combinedText))
            {
                // Kiểm tra xem row có bất kỳ giá trị nào không (kể cả null/empty)
                var hasAnyValue = row.Values.Any(v => v != null && !string.IsNullOrWhiteSpace(v.ToString()));
                if (!hasAnyValue)
                {
                    _logger.LogDebug("Dòng hoàn toàn trống, bỏ qua");
                    continue;
                }
                else
                {
                    // Row có giá trị nhưng không match với columns đã chọn, vẫn lưu với text rỗng
                    _logger.LogWarning("Dòng có giá trị nhưng không match với columns đã chọn, vẫn lưu với combinedText rỗng");
                    combinedText = "[No matching columns]";
                }
            }
            
            // Lưu cả processedText và rawData tương ứng để đảm bảo mapping đúng
            processedTexts.Add(combinedText);
            validRawData.Add(row); // Lưu rawData tương ứng
            _logger.LogDebug("Processed text: {Text}", combinedText.Substring(0, Math.Min(100, combinedText.Length)));
        }

        if (!processedTexts.Any())
        {
            _logger.LogWarning("Không có dữ liệu nào được xử lý từ Excel file");
            _logger.LogError("Không có dữ liệu nào được xử lý từ Excel file");
            _logger.LogError("Số dòng raw data: {RawCount}, Số dòng sau xử lý: {ProcessedCount}", rawData.Count, processedTexts.Count);
            _logger.LogError("Các cột user chọn: {Columns}", string.Join(", ", selectedColumns));
            if (rawData.Any())
            {
                var firstRow = rawData.First();
                _logger.LogError("Ví dụ dòng đầu tiên có các cột: {Columns}", string.Join(", ", firstRow.Keys));
                _logger.LogError("Ví dụ giá trị dòng đầu tiên: {Values}", string.Join(", ", firstRow.Values.Select(v => v?.ToString() ?? "null")));
            }
            throw new InvalidOperationException("Không có dữ liệu hợp lệ để import. Vui lòng kiểm tra lại file Excel và các cột đã chọn.");
        }

        _logger.LogInformation("Đã đọc {Count} dòng từ Excel (sau khi filter)", processedTexts.Count);

        // BƯỚC 2: Generate embeddings (SQL Server 2025 native hoặc Python API fallback)
        List<List<float>>? vectors = null;
        try
        {
            if (_embeddingModelType == "SQL_SERVER")
            {
                _logger.LogInformation("Sử dụng SQL Server 2025 native embedding generation cho {Count} texts", processedTexts.Count);
                vectors = await GetVectorsFromSqlServerAsync(processedTexts);
                _logger.LogInformation("Đã nhận được {Count} vectors từ SQL Server 2025", vectors?.Count ?? 0);
            }
            else
            {
                _logger.LogInformation("Sử dụng Python API để vectorize {Count} texts", processedTexts.Count);
                vectors = await GetVectorsFromPythonAsync(processedTexts);
                _logger.LogInformation("Đã nhận được {Count} vectors từ Python API", vectors?.Count ?? 0);
            }
            
            if (vectors == null || vectors.Count == 0)
            {
                _logger.LogWarning("Embedding service trả về null hoặc empty vectors. Sẽ tạo empty vectors.");
                vectors = new List<List<float>>();
                for (int i = 0; i < processedTexts.Count; i++)
                {
                    vectors.Add(new List<float>());
                }
            }
            else if (vectors.Any(v => v == null || v.Count == 0))
            {
                var emptyCount = vectors.Count(v => v == null || v.Count == 0);
                _logger.LogWarning("Có {EmptyCount}/{Total} vectors rỗng từ embedding service", emptyCount, vectors.Count);
            }
            else
            {
                _logger.LogInformation("Tất cả {Count} vectors đều hợp lệ (không rỗng)", vectors.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi generate embeddings. Sẽ lưu dữ liệu không có vector.");
            // Tạo empty vectors để vẫn có thể lưu data
            vectors = new List<List<float>>();
            for (int i = 0; i < processedTexts.Count; i++)
            {
                vectors.Add(new List<float>()); // Empty vector
            }
        }

        // BƯỚC 3: Lưu vào SQL Server
        // Ở đây ta không chỉ lưu Content & VectorJson mà còn lưu thêm các cột gốc để phục vụ tính toán
        await SaveToDynamicTableAsync(tableName, processedTexts, vectors, validRawData, selectedColumns);

        _logger.LogInformation("Hoàn thành import {Count} records vào bảng {TableName}", 
            processedTexts.Count, tableName);
    }

    /// <summary>
    /// Generate embeddings cho danh sách texts (public method để dùng cho PDF và các nguồn khác)
    /// </summary>
    public async Task<List<List<float>>> GenerateEmbeddingsAsync(List<string> texts)
    {
        if (texts == null || texts.Count == 0)
        {
            _logger.LogWarning("Danh sách texts rỗng, trả về empty vectors");
            return new List<List<float>>();
        }

        if (_embeddingModelType == "SQL_SERVER")
        {
            return await GetVectorsFromSqlServerAsync(texts);
        }
        else
        {
            return await GetVectorsFromPythonAsync(texts);
        }
    }

    /// <summary>
    /// Generate embeddings sử dụng SQL Server 2025 native AI_GENERATE_EMBEDDINGS
    /// </summary>
    private async Task<List<List<float>>> GetVectorsFromSqlServerAsync(List<string> texts)
    {
        _logger.LogInformation("Generate embeddings cho {Count} texts sử dụng SQL Server 2025. Model: {ModelName}", 
            texts.Count, _embeddingModelName);

        if (texts == null || texts.Count == 0)
        {
            _logger.LogWarning("Danh sách texts rỗng, trả về empty vectors");
            return new List<List<float>>();
        }

        var result = new List<List<float>>();

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Process in batches để tránh timeout với số lượng lớn
        const int batchSize = 50;
        for (int batchStart = 0; batchStart < texts.Count; batchStart += batchSize)
        {
            var batch = texts.Skip(batchStart).Take(batchSize).ToList();
            _logger.LogInformation("Processing batch {BatchStart}-{BatchEnd} ({Count} texts)", 
                batchStart, batchStart + batch.Count - 1, batch.Count);

            // Tạo temporary table để chứa texts
            string createTempTableSql = @"
                IF OBJECT_ID('tempdb..#TempTexts') IS NOT NULL DROP TABLE #TempTexts;
                CREATE TABLE #TempTexts (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Text NVARCHAR(MAX)
                );";

            using (var cmd = new SqlCommand(createTempTableSql, conn))
            {
                await cmd.ExecuteNonQueryAsync();
            }

            // Insert texts vào temp table
            foreach (var text in batch)
            {
                string insertSql = "INSERT INTO #TempTexts (Text) VALUES (@Text)";
                using var cmd = new SqlCommand(insertSql, conn);
                cmd.Parameters.AddWithValue("@Text", text ?? string.Empty);
                await cmd.ExecuteNonQueryAsync();
            }

            // Generate embeddings sử dụng AI_GENERATE_EMBEDDINGS
            // Lưu ý: Cần có EXTERNAL MODEL đã được tạo trước (xem CREATE_ONNX_MODEL.sql)
            // Syntax đúng: AI_GENERATE_EMBEDDINGS(text USE MODEL model_name)
            // Trả về JSON type, cần CONVERT sang NVARCHAR(MAX) để parse
            string generateEmbeddingsSql = $@"
                SELECT 
                    Id,
                    Text,
                    CONVERT(NVARCHAR(MAX), AI_GENERATE_EMBEDDINGS(Text USE MODEL {_embeddingModelName})) AS EmbeddingJson
                FROM #TempTexts
                ORDER BY Id;";

            try
            {
                using var cmd = new SqlCommand(generateEmbeddingsSql, conn);
                using var reader = await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    // AI_GENERATE_EMBEDDINGS trả về JSON string: [0.1, 0.2, 0.3, ...]
                    var embeddingJson = reader["EmbeddingJson"];
                    
                    if (embeddingJson == DBNull.Value || embeddingJson == null)
                    {
                        _logger.LogWarning("Embedding null cho text tại index {Index}", result.Count);
                        result.Add(new List<float>());
                        continue;
                    }

                    // Parse JSON string thành List<float>
                    List<float>? vector = null;
                    string? jsonString = null;

                    if (embeddingJson is string str)
                    {
                        jsonString = str;
                    }
                    else
                    {
                        // Convert sang string nếu không phải string
                        jsonString = embeddingJson.ToString();
                    }

                    if (!string.IsNullOrWhiteSpace(jsonString))
                    {
                        try
                        {
                            // Parse JSON array: [0.1, 0.2, 0.3, ...]
                            vector = ParseVectorFromString(jsonString);
                            
                            if (result.Count < 3) // Log first 3 for debugging
                            {
                                _logger.LogInformation("Parsed embedding với {Dimensions} dimensions từ JSON", vector?.Count ?? 0);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Lỗi khi parse embedding JSON cho text tại index {Index}. JSON: {Json}", 
                                result.Count, jsonString != null && jsonString.Length > 0 ? jsonString.Substring(0, Math.Min(100, jsonString.Length)) : "null");
                            vector = new List<float>();
                        }
                    }

                    if (vector == null || vector.Count == 0)
                    {
                        _logger.LogWarning("Không thể parse embedding cho text tại index {Index}. JSON: {Json}", 
                            result.Count, jsonString?.Substring(0, Math.Min(50, jsonString?.Length ?? 0)) ?? "null");
                        result.Add(new List<float>());
                    }
                    else
                    {
                        result.Add(vector);
                        if (result.Count <= 3)
                        {
                            _logger.LogInformation("Parsed embedding với {Dimensions} dimensions", vector.Count);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi generate embeddings từ SQL Server. Có thể EXTERNAL MODEL chưa được tạo. " +
                    "Xem file SQL_SERVER_2025_EMBEDDINGS_SETUP.sql để tạo model. Error: {Error}", ex.Message);
                
                // Fallback: tạo empty vectors cho batch này
                for (int i = 0; i < batch.Count; i++)
                {
                    result.Add(new List<float>());
                }
            }
            finally
            {
                // Cleanup temp table
                try
                {
                    string dropTempTableSql = "IF OBJECT_ID('tempdb..#TempTexts') IS NOT NULL DROP TABLE #TempTexts;";
                    using var cmd = new SqlCommand(dropTempTableSql, conn);
                    await cmd.ExecuteNonQueryAsync();
                }
                catch { }
            }
        }

        _logger.LogInformation("Đã generate {Count} embeddings từ SQL Server 2025", result.Count);
        return result;
    }

    /// <summary>
    /// Parse VECTOR từ binary format của SQL Server
    /// </summary>
    private List<float> ParseVectorFromBytes(byte[] bytes)
    {
        // SQL Server VECTOR type binary format:
        // - First 2 bytes: dimension count (little-endian)
        // - Followed by: float values (4 bytes each, little-endian)
        if (bytes == null || bytes.Length < 2)
        {
            return new List<float>();
        }

        var result = new List<float>();
        int dimension = BitConverter.ToInt16(bytes, 0);
        
        if (bytes.Length < 2 + dimension * 4)
        {
            _logger.LogWarning("Vector bytes không đủ. Expected: {Expected}, Actual: {Actual}", 
                2 + dimension * 4, bytes.Length);
            return new List<float>();
        }

        for (int i = 0; i < dimension; i++)
        {
            float value = BitConverter.ToSingle(bytes, 2 + i * 4);
            result.Add(value);
        }

        return result;
    }

    /// <summary>
    /// Parse VECTOR từ string format '[0.1,0.2,0.3]'
    /// </summary>
    private List<float> ParseVectorFromString(string vectorString)
    {
        if (string.IsNullOrWhiteSpace(vectorString))
        {
            return new List<float>();
        }

        // Remove brackets and split by comma
        var cleaned = vectorString.Trim().TrimStart('[').TrimEnd(']');
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return new List<float>();
        }

        var parts = cleaned.Split(',');
        var result = new List<float>();

        foreach (var part in parts)
        {
            if (float.TryParse(part.Trim(), System.Globalization.NumberStyles.Float, 
                System.Globalization.CultureInfo.InvariantCulture, out float value))
            {
                result.Add(value);
            }
        }

        return result;
    }

    /// <summary>
    /// Generate embeddings sử dụng Python API (fallback)
    /// </summary>
    private async Task<List<List<float>>> GetVectorsFromPythonAsync(List<string> texts)
    {
        _logger.LogInformation("Gửi {Count} texts đến Python API để vectorize. URL: {Url}", texts.Count, _pythonApiUrl);

        if (texts == null || texts.Count == 0)
        {
            _logger.LogWarning("Danh sách texts rỗng, trả về empty vectors");
            return new List<List<float>>();
        }

        var payload = new { texts = texts };
        var jsonPayload = JsonSerializer.Serialize(payload);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        try
        {
            _logger.LogInformation("Đang gọi Python API tại {Url}...", _pythonApiUrl);
            var response = await _httpClient.PostAsync(_pythonApiUrl, content);
            
            _logger.LogInformation("Python API response status: {StatusCode}", response.StatusCode);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Python API trả về lỗi {StatusCode}: {Error}", response.StatusCode, errorContent);
                throw new HttpRequestException($"Python API trả về lỗi {response.StatusCode}: {errorContent}");
            }

            var responseString = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("Python API response length: {Length} characters", responseString.Length);
            
            using var doc = JsonDocument.Parse(responseString);
            
            // Parse JSON trả về: {"vectors": [[0.1, 0.2...], [...]]}
            var result = new List<List<float>>();
            if (doc.RootElement.TryGetProperty("vectors", out var vectorsElement))
            {
                foreach (var vecApi in vectorsElement.EnumerateArray())
                {
                    var floatList = vecApi.EnumerateArray().Select(x => x.GetSingle()).ToList();
                    result.Add(floatList);
                }
                
                _logger.LogInformation("Nhận được {Count} vectors từ Python API. Vector dimensions: {Dimensions}", 
                    result.Count, result.FirstOrDefault()?.Count ?? 0);
            }
            else
            {
                _logger.LogError("Python API không trả về property 'vectors'. Response: {Response}", 
                    responseString.Substring(0, Math.Min(500, responseString.Length)));
                throw new InvalidOperationException("Python API response không đúng format: thiếu property 'vectors'");
            }

            if (result.Count != texts.Count)
            {
                _logger.LogWarning("Số lượng vectors ({VectorCount}) không khớp với số lượng texts ({TextCount})", 
                    result.Count, texts.Count);
            }

            return result;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Lỗi khi gọi Python API: {Url}. Error: {Error}", _pythonApiUrl, ex.Message);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi không mong đợi khi gọi Python API: {Url}", _pythonApiUrl);
            throw;
        }
    }

    /// <summary>
    /// Lưu dữ liệu vào bảng động:
    /// - Content: text đã gộp từ các cột được chọn (dùng cho vector search)
    /// - VectorJson: vector embeddings
    /// - Các cột gốc từ Excel: lưu ra từng cột riêng để phục vụ tính toán / report
    /// CHỈ lưu các cột được chọn (selectedColumns), không lưu tất cả các cột từ Excel
    /// </summary>
    private async Task SaveToDynamicTableAsync(
        string tableName, 
        List<string> contents, 
        List<List<float>> vectors,
        List<IDictionary<string, object>> rawRows,
        List<string> selectedColumns)
    {
        if (contents.Count != vectors.Count)
        {
            _logger.LogError("Số lượng contents ({ContentCount}) và vectors ({VectorCount}) không khớp", 
                contents.Count, vectors.Count);
            throw new ArgumentException($"Số lượng contents ({contents.Count}) và vectors ({vectors.Count}) không khớp");
        }

        if (contents.Count != rawRows.Count)
        {
            _logger.LogWarning("Số lượng contents ({ContentCount}) và rawRows ({RawRowCount}) không khớp. Có thể do filter dòng trống.", 
                contents.Count, rawRows.Count);
            // Không throw exception vì có thể do filter dòng trống
        }

        // Sanitize tên bảng (Chống SQL Injection cơ bản)
        // Chỉ cho phép chữ cái, số, dấu gạch dưới
        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        
        if (string.IsNullOrWhiteSpace(safeTableName))
        {
            throw new ArgumentException("Tên bảng không hợp lệ", nameof(tableName));
        }

        _logger.LogInformation("Lưu dữ liệu vào bảng: {TableName}", safeTableName);

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // CHỈ lấy các cột được chọn từ selectedColumns, không lấy tất cả các cột từ Excel
        // Tìm các headers thực sự có trong rawRows và match với selectedColumns
        var availableHeaders = rawRows
            .SelectMany(r => r.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        
        // Filter: chỉ lấy các cột được chọn và có trong Excel
        var headersToSave = selectedColumns
            .Where(sc => availableHeaders.Any(ah => string.Equals(ah, sc, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        
        _logger.LogInformation("Các cột sẽ được lưu vào database ({Count}): {Columns}", 
            headersToSave.Count, string.Join(", ", headersToSave));

        // Map: tên header gốc -> tên cột SQL an toàn
        var headerToColumn = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        int colIndex = 0;

        foreach (var header in headersToSave)
        {
            string MakeSafeColumnName(string sourceName, int index)
            {
                var sb = new StringBuilder();
                foreach (var ch in sourceName)
                {
                    if (char.IsLetterOrDigit(ch) || ch == '_')
                    {
                        sb.Append(ch);
                    }
                    else if (char.IsWhiteSpace(ch))
                    {
                        sb.Append('_');
                    }
                }

                var baseName = sb.Length > 0 ? sb.ToString() : $"Col_{index}";
                if (char.IsDigit(baseName[0]))
                {
                    baseName = "_" + baseName;
                }

                // Tránh trùng tên
                var finalName = baseName;
                int suffix = 1;
                while (headerToColumn.Values.Contains(finalName, StringComparer.OrdinalIgnoreCase)
                       || string.Equals(finalName, "Content", StringComparison.OrdinalIgnoreCase)
                       || string.Equals(finalName, "VectorJson", StringComparison.OrdinalIgnoreCase)
                       || string.Equals(finalName, "ID", StringComparison.OrdinalIgnoreCase))
                {
                    finalName = $"{baseName}_{suffix++}";
                }

                return finalName;
            }

            var safeColumn = MakeSafeColumnName(header, colIndex++);
            headerToColumn[header] = safeColumn;
        }

        // 3.1. Tạo bảng nếu chưa tồn tại (với VECTOR type cho SQL Server 2025+)
        // Check SQL Server version to determine if VECTOR type is supported
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
                        VectorJson NVARCHAR(MAX) NULL, -- Backward compatibility
                        Embedding VECTOR(384) NULL -- Native VECTOR type (adjust dimension as needed)
                    );
                    
                    -- Vector index will be created manually after import if needed
                    -- CREATE VECTOR INDEX syntax varies by SQL Server version
                    -- You can create it later using SQL Server Management Studio or a separate script
                END
                ELSE
                BEGIN
                    -- SQL Server 2022 or earlier - use JSON only
                    CREATE TABLE dbo.[{safeTableName}] (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        Content NVARCHAR(MAX),
                        VectorJson NVARCHAR(MAX) NULL -- Lưu chuỗi JSON vector
                    );
                END
            END";
        
        using (var cmd = new SqlCommand(createTableSql, conn))
        {
            await cmd.ExecuteNonQueryAsync();
            _logger.LogInformation("Đã tạo/kiểm tra bảng: {TableName}", safeTableName);
        }

        // 3.1.1. Đảm bảo các cột Content và VectorJson tồn tại (nếu bảng đã tồn tại từ trước)
        string ensureColumnsSql = $@"
            -- Kiểm tra và thêm cột Content nếu chưa có
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'dbo' 
                AND TABLE_NAME = '{safeTableName}' 
                AND COLUMN_NAME = 'Content'
            )
            BEGIN
                ALTER TABLE dbo.[{safeTableName}] ADD Content NVARCHAR(MAX);
                PRINT 'Đã thêm cột Content';
            END

            -- Kiểm tra và thêm cột VectorJson nếu chưa có
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'dbo' 
                AND TABLE_NAME = '{safeTableName}' 
                AND COLUMN_NAME = 'VectorJson'
            )
            BEGIN
                ALTER TABLE dbo.[{safeTableName}] ADD VectorJson NVARCHAR(MAX) NULL;
                PRINT 'Đã thêm cột VectorJson';
            END
        ";

        using (var cmd = new SqlCommand(ensureColumnsSql, conn))
        {
            await cmd.ExecuteNonQueryAsync();
            _logger.LogInformation("Đã đảm bảo các cột Content và VectorJson tồn tại");
        }

        // 3.1.1. Đảm bảo các cột động từ Excel tồn tại
        foreach (var kvp in headerToColumn)
        {
            string colName = kvp.Value;
            string ensureColumnSql = $@"
                IF COL_LENGTH('dbo.[{safeTableName}]', '{colName}') IS NULL
                BEGIN
                    ALTER TABLE dbo.[{safeTableName}] ADD [{colName}] NVARCHAR(MAX) NULL;
                END";

            using var colCmd = new SqlCommand(ensureColumnSql, conn);
            await colCmd.ExecuteNonQueryAsync();
        }

        // Chuẩn bị INSERT statement với các cột động
        // Check if VECTOR column exists (SQL Server 2025+)
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

        var dynamicColumns = headerToColumn.Values.ToList();
        var allColumnNames = new List<string> { "Content", "VectorJson" };
        if (hasVectorColumn)
        {
            allColumnNames.Add("Embedding"); // Add VECTOR column for SQL Server 2025+
        }
        allColumnNames.AddRange(dynamicColumns);

        string columnsSql = string.Join(", ", allColumnNames.Select(c => $"[{c}]"));
        // For VECTOR column, use CAST to convert string to VECTOR type
        string valuesSql = string.Join(", ", allColumnNames.Select(c => 
            c == "Embedding" ? "CAST(@Embedding AS VECTOR(384))" : $"@{c}"));
        string insertSqlTemplate = $"INSERT INTO dbo.[{safeTableName}] ({columnsSql}) VALUES ({valuesSql})";

        // 3.2. Insert dữ liệu (Dùng Transaction cho an toàn)
        using var transaction = conn.BeginTransaction();
        try
        {
            // Lưu ý: Thực tế nên dùng SqlBulkCopy cho file rất lớn
            int insertedCount = 0;

            for (int i = 0; i < contents.Count; i++)
            {
                var text = contents[i];
                var vector = vectors[i];

                if (string.IsNullOrWhiteSpace(text))
                {
                    _logger.LogWarning("Bỏ qua dòng có Content rỗng (index={Index})", i);
                    continue;
                }

                // Xử lý vector: nếu rỗng thì lưu null, nếu có thì serialize
                string? vectorJson = null;
                string? vectorString = null; // For VECTOR type (SQL Server 2025+)
                
                if (vector != null && vector.Count > 0)
                {
                    try
                    {
                        vectorJson = JsonSerializer.Serialize(vector);
                        
                        // For SQL Server 2025+ VECTOR type: format as '[0.1,0.2,0.3]'
                        if (hasVectorColumn)
                        {
                            vectorString = "[" + string.Join(",", vector.Select(v => v.ToString("R", System.Globalization.CultureInfo.InvariantCulture))) + "]";
                        }
                        
                        if (i < 3) // Log first 3 rows for debugging
                        {
                            _logger.LogInformation("Row {Index}: Vector có {Count} dimensions, vectorJson length={Length}, vectorString length={StringLength}", 
                                i, vector.Count, vectorJson?.Length ?? 0, vectorString?.Length ?? 0);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Lỗi khi serialize vector cho row {Index}, sẽ lưu null", i);
                        vectorJson = null;
                        vectorString = null;
                    }
                }
                else
                {
                    if (i < 3) // Log first 3 rows for debugging
                    {
                        _logger.LogWarning("Row {Index}: Vector null hoặc empty (vector={Vector}, Count={Count})", 
                            i, vector == null ? "null" : "not null", vector?.Count ?? 0);
                    }
                }

                using var cmd = new SqlCommand(insertSqlTemplate, conn, transaction);
                cmd.Parameters.AddWithValue("@Content", text.Trim());
                cmd.Parameters.AddWithValue("@VectorJson", vectorJson ?? (object)DBNull.Value);
                
                // Add VECTOR parameter for SQL Server 2025+
                if (hasVectorColumn)
                {
                    if (!string.IsNullOrEmpty(vectorString))
                    {
                        // Use CAST to convert string to VECTOR type
                        // SQL Server 2025+ supports: CAST('[0.1,0.2,0.3]' AS VECTOR(384))
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

                // Lấy dòng raw tương ứng (đảm bảo mapping đúng)
                IDictionary<string, object>? rawRow = i < rawRows.Count ? rawRows[i] : null;

                if (rawRow == null)
                {
                    _logger.LogWarning("Không tìm thấy rawRow tương ứng cho index {Index}", i);
                }

                foreach (var kvp in headerToColumn)
                {
                    var header = kvp.Key;
                    var colName = kvp.Value;

                    object? value = null;

                    if (rawRow != null)
                    {
                        // Tìm key theo case-insensitive
                        var matchingKey = rawRow.Keys.FirstOrDefault(k => 
                            string.Equals(k, header, StringComparison.OrdinalIgnoreCase));

                        if (matchingKey != null && rawRow[matchingKey] != null)
                        {
                            value = rawRow[matchingKey];
                        }
                    }

                    cmd.Parameters.AddWithValue("@" + colName, value ?? (object)DBNull.Value);
                }

                try
                {
                    await cmd.ExecuteNonQueryAsync();
                    insertedCount++;
                    
                    if (i < 3) // Log first 3 rows for debugging
                    {
                        _logger.LogInformation("Row {Index}: Đã insert thành công. Content length={ContentLength}, VectorJson={HasVectorJson}, Embedding={HasEmbedding}, Dynamic columns={DynamicColCount}", 
                            i, text?.Length ?? 0, vectorJson != null ? "YES" : "NULL", 
                            hasVectorColumn && !string.IsNullOrEmpty(vectorString) ? "YES" : "NULL",
                            headerToColumn.Count);
                    }
                    
                    if ((i + 1) % 100 == 0)
                    {
                        _logger.LogInformation("Đã insert {Count}/{Total} records", insertedCount, contents.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi insert row {Index}: Content={Content}, VectorJson={HasVectorJson}, Embedding={HasEmbedding}, Error={Error}", 
                        i, text?.Substring(0, Math.Min(50, text?.Length ?? 0)) ?? "", 
                        vectorJson != null ? "YES" : "NULL",
                        hasVectorColumn && !string.IsNullOrEmpty(vectorString) ? "YES" : "NULL",
                        ex.Message);
                    throw; // Re-throw để rollback transaction
                }
            }
            
            transaction.Commit();
            _logger.LogInformation("Đã insert {Count} records vào bảng {TableName}", insertedCount, safeTableName);
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "Lỗi khi insert dữ liệu vào bảng {TableName}. Đã rollback transaction", safeTableName);
            throw;
        }
    }

    /// <summary>
    /// Re-import Content từ Excel file (không vectorize lại, chỉ update Content)
    /// Dùng để fix các records đã có VectorJson nhưng Content rỗng
    /// </summary>
    public async Task<int> ReimportContentAsync(Stream fileStream, string tableName, List<string> selectedColumns)
    {
        _logger.LogInformation("Bắt đầu re-import Content. Table: {TableName}, Columns: {Columns}", 
            tableName, string.Join(", ", selectedColumns));

        // Đọc Excel
        var rawData = MiniExcel.Query(fileStream).Cast<IDictionary<string, object>>().ToList();
        var processedTexts = new List<string>();

        _logger.LogInformation("Đã đọc {Count} dòng raw data từ Excel", rawData.Count);
        
        if (rawData.Any())
        {
            var availableColumns = rawData.First().Keys.ToList();
            _logger.LogInformation("Các cột có trong Excel: {Columns}", string.Join(", ", availableColumns));
        }

        foreach (var row in rawData)
        {
            var values = new List<string>();
            
            foreach (var col in selectedColumns)
            {
                var matchingKey = row.Keys.FirstOrDefault(k => 
                    string.Equals(k, col, StringComparison.OrdinalIgnoreCase));
                
                if (matchingKey != null && row[matchingKey] != null)
                {
                    var value = row[matchingKey].ToString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        values.Add(value.Trim());
                    }
                }
            }

            if (values.Count == 0)
            {
                values = row.Values
                    .Where(v => v != null && !string.IsNullOrWhiteSpace(v.ToString()))
                    .Select(v => v.ToString()!.Trim())
                    .ToList();
            }

            string combinedText = string.Join(" - ", values);
            
            if (string.IsNullOrWhiteSpace(combinedText))
            {
                continue;
            }
            
            processedTexts.Add(combinedText);
        }

        if (!processedTexts.Any())
        {
            _logger.LogWarning("Không có dữ liệu nào được xử lý từ Excel file");
            return 0;
        }

        // Update Content trong database (match theo thứ tự row)
        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Lấy tất cả records có VectorJson (theo thứ tự ID)
        string selectSql = $@"
            SELECT ID 
            FROM dbo.[{safeTableName}]
            WHERE VectorJson IS NOT NULL
            ORDER BY ID";

        var recordIds = new List<int>();
        using (var cmd = new SqlCommand(selectSql, conn))
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                recordIds.Add(reader.GetInt32(0));
            }
        }

        _logger.LogInformation("Tìm thấy {RecordCount} records có VectorJson, {TextCount} texts từ Excel", 
            recordIds.Count, processedTexts.Count);

        // Update Content cho từng record (match theo thứ tự)
        int updatedCount = 0;
        using var transaction = conn.BeginTransaction();
        try
        {
            int minCount = Math.Min(recordIds.Count, processedTexts.Count);
            for (int i = 0; i < minCount; i++)
            {
                string updateSql = $"UPDATE dbo.[{safeTableName}] SET Content = @Content WHERE ID = @Id";
                using var cmd = new SqlCommand(updateSql, conn, transaction);
                cmd.Parameters.AddWithValue("@Content", processedTexts[i].Trim());
                cmd.Parameters.AddWithValue("@Id", recordIds[i]);
                
                await cmd.ExecuteNonQueryAsync();
                updatedCount++;
            }
            
            transaction.Commit();
            _logger.LogInformation("Đã cập nhật {Count} records với Content", updatedCount);
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            _logger.LogError(ex, "Lỗi khi update Content");
            throw;
        }

        return updatedCount;
    }

    /// <summary>
    /// Re-vectorize các records đã có Content nhưng chưa có VectorJson hoặc Embedding
    /// </summary>
    public async Task<(int ProcessedCount, int SuccessCount, int ErrorCount)> RevectorizeMissingVectorsAsync(string tableName)
    {
        _logger.LogInformation("Bắt đầu re-vectorize cho bảng: {TableName}", tableName);

        string safeTableName = new string(tableName.Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());
        
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        // Lấy tất cả records có Content nhưng chưa có VectorJson hoặc Embedding
        string selectSql = $@"
            SELECT ID, Content 
            FROM dbo.[{safeTableName}]
            WHERE Content IS NOT NULL 
              AND Content != ''
              AND (VectorJson IS NULL OR Embedding IS NULL)
            ORDER BY ID";

        var recordsToProcess = new List<(int Id, string Content)>();
        using (var cmd = new SqlCommand(selectSql, conn))
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                var id = reader.GetInt32(0);
                var content = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
                if (!string.IsNullOrWhiteSpace(content))
                {
                    recordsToProcess.Add((id, content));
                }
            }
        }

        _logger.LogInformation("Tìm thấy {Count} records cần re-vectorize", recordsToProcess.Count);

        if (recordsToProcess.Count == 0)
        {
            return (0, 0, 0);
        }

        // Chia thành batches để xử lý
        const int batchSize = 50;
        int successCount = 0;
        int errorCount = 0;

        for (int batchStart = 0; batchStart < recordsToProcess.Count; batchStart += batchSize)
        {
            var batch = recordsToProcess.Skip(batchStart).Take(batchSize).ToList();
            _logger.LogInformation("Processing batch {BatchStart}-{BatchEnd} ({Count} records)", 
                batchStart, batchStart + batch.Count - 1, batch.Count);

            try
            {
                // Generate embeddings cho batch
                var texts = batch.Select(r => r.Content).ToList();
                var vectors = await GenerateEmbeddingsAsync(texts);

                if (vectors.Count != texts.Count)
                {
                    _logger.LogWarning("Số lượng vectors ({VectorCount}) không khớp với số lượng texts ({TextCount})", 
                        vectors.Count, texts.Count);
                    // Pad với empty vectors nếu thiếu
                    while (vectors.Count < texts.Count)
                    {
                        vectors.Add(new List<float>());
                    }
                }

                // Update VectorJson và Embedding cho từng record
                using var transaction = conn.BeginTransaction();
                try
                {
                    for (int i = 0; i < batch.Count; i++)
                    {
                        var record = batch[i];
                        var vector = i < vectors.Count ? vectors[i] : new List<float>();

                        string? vectorJson = null;
                        string? vectorString = null;

                        if (vector != null && vector.Count > 0)
                        {
                            try
                            {
                                vectorJson = JsonSerializer.Serialize(vector);
                                vectorString = string.Join(",", vector.Select(v => v.ToString("F6")));
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Lỗi khi serialize vector cho record ID {Id}", record.Id);
                            }
                        }

                        // Update SQL
                        string updateSql = $@"
                            UPDATE dbo.[{safeTableName}]
                            SET VectorJson = @VectorJson,
                                Embedding = CASE WHEN @Embedding IS NOT NULL THEN CAST(@Embedding AS VECTOR(384)) ELSE NULL END
                            WHERE ID = @Id";

                        using var cmd = new SqlCommand(updateSql, conn, transaction);
                        cmd.Parameters.AddWithValue("@Id", record.Id);
                        cmd.Parameters.AddWithValue("@VectorJson", vectorJson ?? (object)DBNull.Value);

                        if (!string.IsNullOrEmpty(vectorString))
                        {
                            cmd.Parameters.Add(new SqlParameter("@Embedding", SqlDbType.NVarChar)
                            {
                                Value = $"[{vectorString}]"
                            });
                        }
                        else
                        {
                            cmd.Parameters.AddWithValue("@Embedding", DBNull.Value);
                        }

                        await cmd.ExecuteNonQueryAsync();
                        successCount++;
                    }

                    transaction.Commit();
                    _logger.LogInformation("Đã update thành công batch {BatchStart}-{BatchEnd}", 
                        batchStart, batchStart + batch.Count - 1);
                }
                catch (Exception ex)
                {
                    transaction.Rollback();
                    _logger.LogError(ex, "Lỗi khi update batch {BatchStart}-{BatchEnd}", 
                        batchStart, batchStart + batch.Count - 1);
                    errorCount += batch.Count;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi generate embeddings cho batch {BatchStart}-{BatchEnd}", 
                    batchStart, batchStart + batch.Count - 1);
                errorCount += batch.Count;
            }
        }

        _logger.LogInformation("Hoàn thành re-vectorize: {ProcessedCount} records, {SuccessCount} thành công, {ErrorCount} lỗi", 
            recordsToProcess.Count, successCount, errorCount);

        return (recordsToProcess.Count, successCount, errorCount);
    }
}
