using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using Microsoft.Extensions.Logging;
using System.Text;

namespace THIHI_AI.Backend.Services;

public class PdfProcessingService
{
    private readonly ILogger<PdfProcessingService> _logger;

    public PdfProcessingService(ILogger<PdfProcessingService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Trích xuất text từ PDF file
    /// </summary>
    public async Task<List<PdfChunk>> ExtractTextFromPdfAsync(Stream pdfStream, string fileName)
    {
        _logger.LogInformation("Bắt đầu trích xuất text từ PDF: {FileName}", fileName);

        // Wrap CPU-intensive PDF processing in Task.Run to avoid blocking
        return await Task.Run(() =>
        {
            var chunks = new List<PdfChunk>();
            
            try
            {
                using var document = PdfDocument.Open(pdfStream);
                
                _logger.LogInformation("PDF có {PageCount} trang", document.NumberOfPages);

                int pageNumber = 0;
                foreach (var page in document.GetPages())
                {
                    pageNumber++;
                    
                    // Trích xuất text từ trang bằng cách lấy tất cả words và nối lại
                    var textBuilder = new StringBuilder();
                    foreach (var word in page.GetWords())
                    {
                        if (textBuilder.Length > 0)
                            textBuilder.Append(" ");
                        textBuilder.Append(word.Text);
                    }
                    var text = textBuilder.ToString();
                    
                    if (string.IsNullOrWhiteSpace(text))
                    {
                        _logger.LogWarning("Trang {PageNumber} không có text (có thể là scan)", pageNumber);
                        continue;
                    }

                    // Chia nhỏ text thành các chunks (mỗi chunk ~500-1000 ký tự)
                    var pageChunks = SplitIntoChunks(text, pageNumber, fileName);
                    chunks.AddRange(pageChunks);
                    
                    _logger.LogDebug("Trang {PageNumber}: {TextLength} ký tự, chia thành {ChunkCount} chunks", 
                        pageNumber, text.Length, pageChunks.Count);
                }

                _logger.LogInformation("Đã trích xuất {ChunkCount} chunks từ PDF {FileName}", 
                    chunks.Count, fileName);

                return chunks;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi trích xuất text từ PDF: {FileName}", fileName);
                throw;
            }
        });
    }

    /// <summary>
    /// Chia text thành các chunks nhỏ hơn để vectorize
    /// Strategy: Chia theo câu, mỗi chunk ~500-1000 ký tự
    /// </summary>
    private List<PdfChunk> SplitIntoChunks(string text, int pageNumber, string fileName, 
        int maxChunkSize = 800, int overlapSize = 100)
    {
        var chunks = new List<PdfChunk>();
        
        if (string.IsNullOrWhiteSpace(text))
        {
            return chunks;
        }

        // Chia theo câu (dấu chấm, xuống dòng)
        var sentences = text.Split(new[] { ". ", ".\n", "\n\n", "。", "！", "？", "\r\n\r\n" }, 
            StringSplitOptions.RemoveEmptyEntries);

        var currentChunk = new StringBuilder();
        int chunkIndex = 0;

        foreach (var sentence in sentences)
        {
            var trimmedSentence = sentence.Trim();
            if (string.IsNullOrWhiteSpace(trimmedSentence))
                continue;

            // Nếu thêm câu này vượt quá maxChunkSize, lưu chunk hiện tại
            if (currentChunk.Length > 0 && 
                currentChunk.Length + trimmedSentence.Length > maxChunkSize)
            {
                var chunkText = currentChunk.ToString().Trim();
                if (!string.IsNullOrWhiteSpace(chunkText))
                {
                    chunks.Add(new PdfChunk
                    {
                        Text = chunkText,
                        PageNumber = pageNumber,
                        FileName = fileName,
                        ChunkIndex = chunkIndex++
                    });
                }

                // Bắt đầu chunk mới với overlap (lấy một phần cuối của chunk cũ)
                var overlapText = chunkText.Length > overlapSize 
                    ? chunkText.Substring(chunkText.Length - overlapSize)
                    : chunkText;
                currentChunk = new StringBuilder(overlapText);
            }

            if (currentChunk.Length > 0)
                currentChunk.Append(" ");
            
            currentChunk.Append(trimmedSentence);
        }

        // Lưu chunk cuối cùng
        if (currentChunk.Length > 0)
        {
            var chunkText = currentChunk.ToString().Trim();
            if (!string.IsNullOrWhiteSpace(chunkText))
            {
                chunks.Add(new PdfChunk
                {
                    Text = chunkText,
                    PageNumber = pageNumber,
                    FileName = fileName,
                    ChunkIndex = chunkIndex
                });
            }
        }

        return chunks;
    }
}

/// <summary>
/// Model đại diện cho một đoạn text từ PDF
/// </summary>
public class PdfChunk
{
    public string Text { get; set; } = string.Empty;
    public int PageNumber { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int ChunkIndex { get; set; }
    
    /// <summary>
    /// Metadata để hiển thị trong kết quả tìm kiếm
    /// </summary>
    public string GetMetadata()
    {
        return $"Trang {PageNumber}, Chunk {ChunkIndex + 1} - {FileName}";
    }
}
