# Hướng Dẫn Tìm Kiếm Thông Minh với Vector Search

## 📋 Tổng Quan

Hệ thống tìm kiếm thông minh sử dụng **Vector Embeddings** và **Cosine Similarity** để tìm kiếm dữ liệu dựa trên ý nghĩa (semantic search) thay vì chỉ tìm kiếm từ khóa chính xác.

## 🎯 Tính Năng

- ✅ **Semantic Search**: Tìm kiếm dựa trên ý nghĩa, không chỉ từ khóa
- ✅ **Cosine Similarity**: Tính độ tương đồng giữa query và dữ liệu
- ✅ **Flexible Threshold**: Điều chỉnh ngưỡng similarity để lọc kết quả
- ✅ **Multi-table Support**: Tìm kiếm trong nhiều bảng khác nhau
- ✅ **Real-time Vectorization**: Tự động vectorize query trước khi search

## 🏗️ Kiến Trúc

```
User Query
    ↓
Angular Frontend
    ↓
.NET Backend API (/api/search/vector)
    ↓
Python API (Vectorize query)
    ↓
SQL Server (Load all vectors)
    ↓
Calculate Cosine Similarity
    ↓
Return Top N Results
```

## 📡 API Endpoints

### POST `/api/search/vector`

Tìm kiếm với vector similarity.

**Request:**
```json
{
  "query": "Tìm máy bơm công suất 5HP",
  "tableName": "TSMay",
  "topN": 10,
  "similarityThreshold": 0.3
}
```

**Response:**
```json
{
  "query": "Tìm máy bơm công suất 5HP",
  "tableName": "TSMay",
  "totalResults": 5,
  "results": [
    {
      "id": 1,
      "content": "Máy Bơm - Model X - Công suất 5HP",
      "similarity": 0.85
    },
    {
      "id": 2,
      "content": "Máy Bơm - Model Y - Công suất 5.5HP",
      "similarity": 0.72
    }
  ]
}
```

### GET `/api/search/health`

Kiểm tra service hoạt động.

## 🚀 Cách Sử Dụng

### 1. Trong Angular Component

```typescript
import { VectorSearchService } from './services/vector-search.service';

constructor(private searchService: VectorSearchService) {}

async search() {
  const response = await this.searchService.search(
    'Tìm máy bơm công suất 5HP',
    'TSMay',
    10,
    0.3
  ).toPromise();
  
  console.log('Results:', response.results);
}
```

### 2. Trong Chat Service (Tự động search)

```typescript
// Chat service đã tích hợp sẵn
this.chatService.searchVector(query, 'TSMay', 5, 0.3)
  .subscribe(results => {
    // Sử dụng kết quả để enhance AI response
  });
```

### 3. Trong Chat Component

Chat component có thể tự động gọi vector search khi user hỏi về dữ liệu:

```typescript
// Tự động search khi detect câu hỏi về dữ liệu
if (this.isDataQuery(question)) {
  this.chatService.searchVector(question, 'TSMay', 5, 0.3)
    .subscribe(results => {
      // Thêm kết quả vào context cho AI
    });
}
```

## 📊 Cosine Similarity

### Công Thức

```
similarity = (A · B) / (||A|| × ||B||)
```

Trong đó:
- `A · B`: Dot product của 2 vectors
- `||A||`: Magnitude (độ dài) của vector A
- `||B||`: Magnitude (độ dài) của vector B

### Ý Nghĩa

- **1.0**: Hoàn toàn giống nhau
- **0.7-0.9**: Rất tương đồng
- **0.5-0.7**: Tương đồng
- **0.3-0.5**: Ít tương đồng
- **< 0.3**: Không tương đồng

### Ngưỡng Khuyến Nghị

- **0.7+**: Kết quả rất chính xác (ít kết quả)
- **0.5-0.7**: Cân bằng giữa độ chính xác và số lượng
- **0.3-0.5**: Nhiều kết quả hơn nhưng có thể ít liên quan

## 🔧 Cấu Hình

### Backend (.NET)

File: `backend/THIHI_AI.Backend/appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=THITHI_AI;Integrated Security=true;TrustServerCertificate=true;"
  },
  "PythonApi": {
    "VectorizeUrl": "http://localhost:5005/vectorize"
  }
}
```

### Frontend (Angular)

File: `src/environments/environment.ts`

```typescript
export const environment = {
  backendApiUrl: "http://localhost:5000"
};
```

## 📝 Ví Dụ Sử Dụng

### Ví dụ 1: Tìm kiếm đơn giản

**Query:** "Máy bơm 5HP"

**Kết quả:**
- "Máy Bơm - Model X - Công suất 5HP" (similarity: 0.92)
- "Máy Bơm - Model Y - Công suất 5.5HP" (similarity: 0.78)
- "Máy Bơm Nước - 5HP" (similarity: 0.75)

### Ví dụ 2: Tìm kiếm với từ đồng nghĩa

**Query:** "Thiết bị bơm nước"

**Kết quả:**
- "Máy Bơm - Model X" (similarity: 0.68)
- "Bơm Nước - Model Y" (similarity: 0.65)
- "Pump Water - Model Z" (similarity: 0.58)

### Ví dụ 3: Tìm kiếm với ngữ cảnh

**Query:** "Tìm thiết bị có công suất lớn"

**Kết quả:**
- "Máy Bơm - 10HP" (similarity: 0.71)
- "Máy Nén - 15HP" (similarity: 0.69)
- "Máy Phát Điện - 20kW" (similarity: 0.55)

## 🎨 UI Component

Component `VectorSearchComponent` đã được tạo tại:
- Route: `/search`
- File: `src/app/vector-search/vector-search.component.ts`

**Tính năng UI:**
- ✅ Search box với Enter key support
- ✅ Advanced options (table name, topN, threshold)
- ✅ Hiển thị similarity score với màu sắc
- ✅ Responsive design
- ✅ Loading states

## 🔍 Tích Hợp vào Chat

Chat component có thể tự động sử dụng vector search:

1. **Detect data queries**: Phát hiện câu hỏi về dữ liệu
2. **Auto search**: Tự động gọi vector search
3. **Enhance context**: Thêm kết quả vào context cho AI
4. **Display results**: Hiển thị kết quả trong chat

## ⚡ Performance

### Tối Ưu

1. **Index vectors**: Tạo index trên VectorJson column (nếu SQL Server hỗ trợ)
2. **Batch processing**: Xử lý nhiều queries cùng lúc
3. **Caching**: Cache vectors trong memory
4. **Limit results**: Giới hạn số lượng vectors load từ DB

### Lưu Ý

- Với bảng lớn (>10,000 records), nên:
  - Sử dụng SQL Server 2025+ với native vector support
  - Hoặc implement approximate nearest neighbor (ANN)
  - Hoặc chia nhỏ bảng thành partitions

## 🐛 Troubleshooting

### Lỗi: "Không tìm thấy kết quả"

**Giải pháp:**
- Giảm `similarityThreshold` (ví dụ: 0.3 → 0.2)
- Kiểm tra dữ liệu đã được import và vectorize chưa
- Kiểm tra Python API đang chạy

### Lỗi: "Python API không phản hồi"

**Giải pháp:**
- Kiểm tra Python API tại `http://localhost:5005/health`
- Kiểm tra URL trong `appsettings.json`

### Performance chậm

**Giải pháp:**
- Giảm `topN` (ví dụ: 10 → 5)
- Tăng `similarityThreshold` để lọc sớm
- Tối ưu database query

## 📚 Tài Liệu Tham Khảo

- [Vector Search Best Practices](https://www.pinecone.io/learn/vector-search/)
- [Cosine Similarity Explained](https://en.wikipedia.org/wiki/Cosine_similarity)
- [SQL Server Vector Support](https://learn.microsoft.com/en-us/sql/relational-databases/vector/vector-data-type)

## 🎯 Next Steps

1. **Hybrid Search**: Kết hợp keyword search + vector search
2. **Reranking**: Sử dụng cross-encoder để rerank kết quả
3. **Multi-modal**: Hỗ trợ search với images, documents
4. **Analytics**: Track search queries và results để cải thiện

---

**Cần hỗ trợ?** Kiểm tra logs của .NET Backend và Python API để debug.
