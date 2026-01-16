using MiniExcelLibs;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Text;
using System.Text.Json;
using System.Linq;

namespace THIHI_AI.Backend.Services;

public class VectorImportService
{
    private readonly string _connectionString;
    private readonly HttpClient _httpClient;
    private readonly string _pythonApiUrl;
    private readonly ILogger<VectorImportService> _logger;

    public VectorImportService(Microsoft.Extensions.Configuration.IConfiguration config, HttpClient httpClient, ILogger<VectorImportService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection") 
            ?? throw new ArgumentNullException(nameof(config), "DefaultConnection string is required");
        _httpClient = httpClient;
        _pythonApiUrl = config["PythonApi:VectorizeUrl"] ?? "http://localhost:5005/vectorize";
        _logger = logger;
    }

    public async Task ProcessExcelImportAsync(Stream fileStream, string tableName, List<string> selectedColumns)
    {
        _logger.LogInformation("Bắt đầu xử lý import Excel. Table: {TableName}, Columns: {Columns}", 
            tableName, string.Join(", ", selectedColumns));

        // BƯỚC 1: Đọc và gộp dữ liệu từ Excel
        var rawData = MiniExcel.Query(fileStream).Cast<IDictionary<string, object>>().ToList();
        var processedTexts = new List<string>();
        var validRawData = new List<IDictionary<string, object>>(); // Chỉ lưu các dòng hợp lệ

        _logger.LogInformation("Đã đọc {Count} dòng raw data từ Excel", rawData.Count);
        
        // Log tên các cột có trong Excel để debug
        if (rawData.Any())
        {
            var availableColumns = rawData.First().Keys.ToList();
            _logger.LogInformation("Các cột có trong Excel: {Columns}", string.Join(", ", availableColumns));
            _logger.LogInformation("Các cột user chọn: {Columns}", string.Join(", ", selectedColumns));
        }

        foreach (var row in rawData)
        {
            // Lấy giá trị các cột user chọn và nối lại
            var values = new List<string>();
            
            foreach (var col in selectedColumns)
            {
                // Thử tìm cột với case-insensitive
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

            // Nếu không tìm thấy giá trị từ các cột đã chọn, lấy tất cả các cột có giá trị
            if (values.Count == 0)
            {
                _logger.LogWarning("Không tìm thấy giá trị từ các cột đã chọn, lấy tất cả các cột có giá trị");
                values = row.Values
                    .Where(v => v != null && !string.IsNullOrWhiteSpace(v.ToString()))
                    .Select(v => v.ToString().Trim())
                    .ToList();
            }

            // Ví dụ: "Máy Bơm - Model X - Công suất 5HP"
            string combinedText = string.Join(" - ", values);
            
            // Đảm bảo không lưu empty string
            if (string.IsNullOrWhiteSpace(combinedText))
            {
                _logger.LogWarning("Dòng có combinedText rỗng, bỏ qua");
                continue;
            }
            
            // Lưu cả processedText và rawData tương ứng để đảm bảo mapping đúng
            processedTexts.Add(combinedText);
            validRawData.Add(row); // Lưu rawData tương ứng
            _logger.LogDebug("Processed text: {Text}", combinedText.Substring(0, Math.Min(100, combinedText.Length)));
        }

        if (!processedTexts.Any())
        {
            _logger.LogWarning("Không có dữ liệu nào được xử lý từ Excel file");
            throw new InvalidOperationException("Không có dữ liệu hợp lệ để import. Vui lòng kiểm tra lại file Excel.");
        }

        _logger.LogInformation("Đã đọc {Count} dòng từ Excel (sau khi filter)", processedTexts.Count);

        // BƯỚC 2: Gọi Python để lấy Vector (Chia batch nếu dữ liệu lớn)
        // Nếu file > 1000 dòng, nên chia nhỏ (chunk) để gửi nhiều lần
        List<List<float>>? vectors = null;
        try
        {
            vectors = await GetVectorsFromPythonAsync(processedTexts);
            _logger.LogInformation("Đã nhận được {Count} vectors từ Python API", vectors.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi gọi Python API để vectorize. Sẽ lưu dữ liệu không có vector.");
            // Tạo empty vectors để vẫn có thể lưu data
            vectors = new List<List<float>>();
            for (int i = 0; i < processedTexts.Count; i++)
            {
                vectors.Add(new List<float>()); // Empty vector
            }
        }

        // BƯỚC 3: Lưu vào SQL Server
        // Ở đây ta không chỉ lưu Content & VectorJson mà còn lưu thêm các cột gốc để phục vụ tính toán
        await SaveToDynamicTableAsync(tableName, processedTexts, vectors, validRawData);

        _logger.LogInformation("Hoàn thành import {Count} records vào bảng {TableName}", 
            processedTexts.Count, tableName);
    }

    private async Task<List<List<float>>> GetVectorsFromPythonAsync(List<string> texts)
    {
        _logger.LogInformation("Gửi {Count} texts đến Python API để vectorize", texts.Count);

        var payload = new { texts = texts };
        var jsonPayload = JsonSerializer.Serialize(payload);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.PostAsync(_pythonApiUrl, content);
            response.EnsureSuccessStatusCode();

            var responseString = await response.Content.ReadAsStringAsync();
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
            }
            else
            {
                _logger.LogError("Python API không trả về property 'vectors'");
                throw new InvalidOperationException("Python API response không đúng format");
            }

            _logger.LogInformation("Nhận được {Count} vectors từ Python API", result.Count);
            return result;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Lỗi khi gọi Python API: {Url}", _pythonApiUrl);
            throw;
        }
    }

    /// <summary>
    /// Lưu dữ liệu vào bảng động:
    /// - Content: text đã gộp từ các cột được chọn (dùng cho vector search)
    /// - VectorJson: vector embeddings
    /// - Các cột gốc từ Excel: lưu ra từng cột riêng để phục vụ tính toán / report
    /// </summary>
    private async Task SaveToDynamicTableAsync(
        string tableName, 
        List<string> contents, 
        List<List<float>> vectors,
        List<IDictionary<string, object>> rawRows)
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

        // Xác định danh sách cột gốc từ Excel (để lưu thêm ngoài Content/VectorJson)
        var allHeaders = rawRows
            .SelectMany(r => r.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Map: tên header gốc -> tên cột SQL an toàn
        var headerToColumn = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        int colIndex = 0;

        foreach (var header in allHeaders)
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

        // 3.1. Tạo bảng nếu chưa tồn tại (chỉ với 3 cột cơ bản)
        string createTableSql = $@"
            IF OBJECT_ID('dbo.[{safeTableName}]', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.[{safeTableName}] (
                    ID INT IDENTITY(1,1) PRIMARY KEY,
                    Content NVARCHAR(MAX),
                    VectorJson NVARCHAR(MAX) -- Lưu chuỗi JSON vector
                );
            END";
        
        using (var cmd = new SqlCommand(createTableSql, conn))
        {
            await cmd.ExecuteNonQueryAsync();
            _logger.LogInformation("Đã tạo/kiểm tra bảng: {TableName}", safeTableName);
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
        var dynamicColumns = headerToColumn.Values.ToList();
        var allColumnNames = new List<string> { "Content", "VectorJson" };
        allColumnNames.AddRange(dynamicColumns);

        string columnsSql = string.Join(", ", allColumnNames.Select(c => $"[{c}]"));
        string valuesSql = string.Join(", ", allColumnNames.Select(c => $"@{c}"));
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
                if (vector != null && vector.Count > 0)
                {
                    try
                    {
                        vectorJson = JsonSerializer.Serialize(vector);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Lỗi khi serialize vector cho row {Index}, sẽ lưu null", i);
                        vectorJson = null;
                    }
                }

                using var cmd = new SqlCommand(insertSqlTemplate, conn, transaction);
                cmd.Parameters.AddWithValue("@Content", text.Trim());
                cmd.Parameters.AddWithValue("@VectorJson", vectorJson ?? (object)DBNull.Value);

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
                    
                    if ((i + 1) % 100 == 0)
                    {
                        _logger.LogInformation("Đã insert {Count}/{Total} records", insertedCount, contents.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi insert row {Index}: Content={Content}", 
                        i, text.Substring(0, Math.Min(50, text.Length)));
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
                    .Select(v => v.ToString().Trim())
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
}
