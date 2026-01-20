# Hướng Dẫn Xử Lý PDF cho ChatAI

## Tổng Quan

Tài liệu này hướng dẫn cách tích hợp khả năng đọc và tìm kiếm thông tin trong file PDF vào hệ thống ChatAI hiện tại. Hệ thống sẽ:
1. **Trích xuất text** từ PDF
2. **Chia nhỏ (chunking)** text thành các đoạn phù hợp
3. **Tạo embeddings** (vector hóa) cho từng đoạn
4. **Lưu vào SQL Server** với vector search
5. **Tìm kiếm semantic** khi user hỏi

---

## Giải Pháp Đề Xuất

### Phương Án 1: Sử dụng iTextSharp / iText7 (Khuyến nghị cho .NET)

**Ưu điểm:**
- ✅ Native .NET, không cần Python
- ✅ Hỗ trợ tốt PDF text extraction
- ✅ Có thể xử lý PDF có password
- ✅ Tích hợp dễ với codebase hiện tại

**Nhược điểm:**
- ⚠️ Có thể gặp khó khăn với PDF scan (hình ảnh)
- ⚠️ Cần license cho commercial use (iText7)

**Thư viện:**
- `iText7` (commercial license) hoặc `iTextSharp.LGPLv2` (free, older version)
- `PdfPig` (open source, free) - **Khuyến nghị**

### Phương Án 2: Sử dụng PyPDF2 / pdfplumber (Python API)

**Ưu điểm:**
- ✅ Miễn phí, open source
- ✅ Hỗ trợ tốt PDF phức tạp
- ✅ Có thể OCR (với pdfplumber + Tesseract)

**Nhược điểm:**
- ⚠️ Cần Python service riêng
- ⚠️ Tăng độ phức tạp hệ thống

### Phương Án 3: Sử dụng Azure Document Intelligence / Form Recognizer

**Ưu điểm:**
- ✅ OCR tự động (xử lý PDF scan)
- ✅ Hiểu cấu trúc bảng, form
- ✅ Cloud-based, scalable

**Nhược điểm:**
- ⚠️ Cần Azure subscription
- ⚠️ Có chi phí theo số trang xử lý

---

## Giải Pháp Chi Tiết: PdfPig (Khuyến nghị)

### Bước 1: Cài Đặt Package

Thêm vào `THIHI_AI.Backend.csproj`:

```xml
<PackageReference Include="UglyToad.PdfPig" Version="0.1.8" />
<PackageReference Include="UglyToad.PdfPig.ContentExtraction" Version="0.1.8" />
```

### Bước 2: Tạo PDF Processing Service

Tạo file `Services/PdfProcessingService.cs`:

```csharp
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;
using Microsoft.Extensions.Logging;

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

        var chunks = new List<PdfChunk>();
        
        try
        {
            using var document = PdfDocument.Open(pdfStream);
            
            _logger.LogInformation("PDF có {PageCount} trang", document.NumberOfPages);

            int pageNumber = 0;
            foreach (var page in document.GetPages())
            {
                pageNumber++;
                
                // Trích xuất text từ trang
                var text = ContentOrderTextExtractor.GetText(page);
                
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
        var sentences = text.Split(new[] { ". ", ".\n", "\n\n", "。", "！", "？" }, 
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
```

### Bước 3: Tạo PDF Import Controller

Tạo file `Controllers/PdfImportController.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using THIHI_AI.Backend.Services;

namespace THIHI_AI.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PdfImportController : ControllerBase
{
    private readonly PdfProcessingService _pdfProcessingService;
    private readonly VectorImportService _vectorImportService;
    private readonly ILogger<PdfImportController> _logger;

    public PdfImportController(
        PdfProcessingService pdfProcessingService,
        VectorImportService vectorImportService,
        ILogger<PdfImportController> logger)
    {
        _pdfProcessingService = pdfProcessingService;
        _vectorImportService = vectorImportService;
        _logger = logger;
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
            // Sử dụng VectorImportService hiện có để vectorize và lưu
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
            // Sử dụng method private GetVectorsFromSqlServerAsync hoặc GetVectorsFromPythonAsync
            // Cần refactor VectorImportService để expose method này
            // Tạm thời: tạo service mới hoặc mở rộng VectorImportService
            
            // TODO: Implement vector generation cho PDF chunks
            // Có thể tạo method mới trong VectorImportService: 
            // public async Task<List<List<float>>> GenerateEmbeddingsAsync(List<string> texts)
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi generate embeddings cho PDF chunks");
            throw;
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
        // Tương tự như SaveToDynamicTableAsync trong VectorImportService
        // Nhưng thêm các cột: PageNumber, FileName, ChunkIndex
        
        // TODO: Implement save logic
        // Có thể tái sử dụng code từ VectorImportService.SaveToDynamicTableAsync
        // và thêm các cột metadata cho PDF
    }
}
```

### Bước 4: Đăng Ký Service trong Program.cs

Thêm vào `Program.cs`:

```csharp
// Đăng ký PdfProcessingService
builder.Services.AddScoped<PdfProcessingService>();

// Đăng ký PdfImportController sẽ tự động được đăng ký nếu có [ApiController]
```

---

## Giải Pháp 2: Python API cho PDF (Nếu cần OCR)

Nếu PDF là scan (hình ảnh), cần OCR. Có thể tạo Python service:

### Python Service (pdf_processor.py)

```python
from flask import Flask, request, jsonify
import pdfplumber
import pytesseract
from PIL import Image
import io
import re

app = Flask(__name__)

@app.route('/extract-pdf', methods=['POST'])
def extract_pdf():
    try:
        file = request.files['file']
        
        # Trích xuất text từ PDF
        chunks = []
        with pdfplumber.open(file) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                # Thử extract text trước
                text = page.extract_text()
                
                # Nếu không có text, có thể là scan -> OCR
                if not text or len(text.strip()) < 10:
                    # Convert page to image và OCR
                    # (cần cài đặt pdf2image, pytesseract)
                    pass
                
                # Chia nhỏ text
                page_chunks = split_into_chunks(text, page_num, file.filename)
                chunks.extend(page_chunks)
        
        return jsonify({
            'chunks': [
                {
                    'text': chunk['text'],
                    'pageNumber': chunk['pageNumber'],
                    'chunkIndex': chunk['chunkIndex']
                }
                for chunk in chunks
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def split_into_chunks(text, page_num, filename, max_size=800):
    # Logic chia nhỏ tương tự C#
    chunks = []
    sentences = re.split(r'[.!?\n]+', text)
    current_chunk = []
    current_size = 0
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        if current_size + len(sentence) > max_size and current_chunk:
            chunks.append({
                'text': ' '.join(current_chunk),
                'pageNumber': page_num,
                'chunkIndex': len(chunks),
                'fileName': filename
            })
            current_chunk = [sentence]
            current_size = len(sentence)
        else:
            current_chunk.append(sentence)
            current_size += len(sentence) + 1
    
    if current_chunk:
        chunks.append({
            'text': ' '.join(current_chunk),
            'pageNumber': page_num,
            'chunkIndex': len(chunks),
            'fileName': filename
        })
    
    return chunks

if __name__ == '__main__':
    app.run(port=5006)
```

---

## Giải Pháp 3: Azure Document Intelligence (Cho PDF Scan)

Nếu có Azure subscription và cần xử lý PDF scan:

### Cài đặt Package

```xml
<PackageReference Include="Azure.AI.FormRecognizer" Version="4.1.0" />
```

### Service Code

```csharp
using Azure;
using Azure.AI.FormRecognizer.DocumentAnalysis;

public class AzurePdfService
{
    private readonly DocumentAnalysisClient _client;
    
    public async Task<List<PdfChunk>> ExtractFromAzureAsync(Stream pdfStream)
    {
        var operation = await _client.AnalyzeDocumentAsync(
            WaitUntil.Completed,
            "prebuilt-read",
            pdfStream);
        
        var result = operation.Value;
        
        var chunks = new List<PdfChunk>();
        foreach (var page in result.Pages)
        {
            // Extract text từ page
            var text = string.Join("\n", page.Lines.Select(l => l.Content));
            // Chia nhỏ và tạo chunks
        }
        
        return chunks;
    }
}
```

---

## Tích Hợp với Vector Search Hiện Tại

### Mở Rộng VectorImportService

Thêm method mới vào `VectorImportService.cs`:

```csharp
/// <summary>
/// Generate embeddings cho danh sách texts (public method để dùng cho PDF)
/// </summary>
public async Task<List<List<float>>> GenerateEmbeddingsAsync(List<string> texts)
{
    if (_embeddingModelType == "SQL_SERVER")
    {
        return await GetVectorsFromSqlServerAsync(texts);
    }
    else
    {
        return await GetVectorsFromPythonAsync(texts);
    }
}
```

### Cập Nhật Database Schema

Thêm các cột metadata cho PDF:

```sql
ALTER TABLE [YourTableName] ADD 
    PageNumber INT NULL,
    FileName NVARCHAR(500) NULL,
    ChunkIndex INT NULL,
    DocumentType NVARCHAR(50) NULL DEFAULT 'PDF';
```

---

## Tìm Kiếm trong PDF

Sau khi import PDF, có thể tìm kiếm bằng `VectorSearchService` hiện có:

```csharp
// Trong SearchController hoặc ChatController
var results = await _vectorSearchService.SearchAsync(
    query: "câu hỏi của user",
    tableName: "pdf_documents",
    topK: 5
);

// Kết quả sẽ bao gồm:
// - Content: đoạn text từ PDF
// - PageNumber: số trang
// - FileName: tên file
// - Similarity score
```

---

## Best Practices

1. **Chunking Strategy:**
   - Chia theo câu/đoạn văn, không chia ngẫu nhiên
   - Overlap 10-20% giữa các chunks để không mất context
   - Mỗi chunk ~500-1000 ký tự (tùy model embedding)

2. **Metadata:**
   - Lưu PageNumber, FileName để hiển thị nguồn
   - Có thể thêm Section, Heading nếu extract được

3. **Performance:**
   - Xử lý PDF lớn theo batch
   - Cache embeddings nếu cùng nội dung

4. **Error Handling:**
   - Xử lý PDF bị lỗi, password-protected
   - Fallback sang OCR nếu không extract được text

---

## Testing

Tạo test endpoint:

```csharp
[HttpPost("test-extract")]
public async Task<IActionResult> TestExtract([FromForm] IFormFile file)
{
    using var stream = file.OpenReadStream();
    var chunks = await _pdfProcessingService.ExtractTextFromPdfAsync(stream, file.FileName);
    
    return Ok(new 
    { 
        chunkCount = chunks.Count,
        chunks = chunks.Take(5).Select(c => new 
        {
            c.Text,
            c.PageNumber,
            c.ChunkIndex
        })
    });
}
```

---

## Tóm Tắt

**Khuyến nghị:**
1. Bắt đầu với **PdfPig** (free, native .NET)
2. Nếu cần OCR → thêm **Python service với pdfplumber + Tesseract**
3. Nếu có budget → dùng **Azure Document Intelligence**

**Next Steps:**
1. Cài đặt PdfPig package
2. Tạo PdfProcessingService
3. Tạo PdfImportController
4. Mở rộng VectorImportService để hỗ trợ PDF
5. Test với một vài PDF files
