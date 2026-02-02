# Hướng Dẫn: Đưa File Excel TS_TONGHOP-2021-test.xlsx vào SQL Server 2025 và Vector để ChatAI Tìm Kiếm / Tính Toán

## Mục tiêu

- Import file **TS_TONGHOP-2021-test.xlsx** (trong folder `D:\tailieu\aHuy`) vào **SQL Server 2025**.
- Tạo **vector (embedding)** cho dữ liệu để **ChatAI** có thể **tìm kiếm theo ý nghĩa** và **tính toán** (SUM, AVG, v.v.) trên dữ liệu.

---

## Chuẩn bị

### 1. File Excel

- Đường dẫn: `D:\tailieu\aHuy\TS_TONGHOP-2021-test.xlsx`
- Định dạng: `.xlsx` hoặc `.xls` (đã hỗ trợ).
- File phải có **dòng header** (dòng đầu là tên cột). Các dòng sau là dữ liệu.

### 2. SQL Server 2025

- Đảm bảo SQL Server 2025 đang chạy.
- Database dùng trong project: **THITHI_AI** (theo `appsettings.json`).
- Connection string trong `backend\THIHI_AI.Backend\appsettings.json`:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=.\\MSSQLSERVER2025;Database=THITHI_AI;User Id=sa;Password=123456;TrustServerCertificate=true;Encrypt=true;"
}
```

- Nếu bạn dùng server/instance hoặc mật khẩu khác, hãy sửa lại cho đúng.

### 3. Tạo Vector (Embedding) – chọn một trong hai cách

**Cách A: Dùng Python API (đơn giản, không cần Azure)**

- Trong `appsettings.json` giữ:

```json
"Embedding": {
  "Type": "PYTHON_API",
  "ModelName": "",
  "Dimension": 768
},
"PythonApi": {
  "VectorizeUrl": "http://localhost:5005/vectorize"
}
```

- Chạy Python API (project `THITHI_python-api` hoặc tương đương):  
  `python app.py` (thường chạy tại `http://localhost:5005`).  
- Khi import Excel, Backend sẽ gọi API này để tạo vector.

**Cách B: Dùng SQL Server 2025 Native Embedding (không cần Python)**

- Trong `appsettings.json` đổi thành:

```json
"Embedding": {
  "Type": "SQL_SERVER",
  "ModelName": "azure_openai_embeddings"
}
```

- Trong SQL Server 2025 phải tạo sẵn **EXTERNAL MODEL** (Azure OpenAI hoặc ONNX). Chi tiết xem: `backend\THIHI_AI.Backend\HUONG_DAN_SQL_SERVER_2025_EMBEDDINGS.md`.

---

## Các bước thực hiện

### Bước 1: Khởi động Backend (.NET)

```powershell
cd D:\Project\thibidi\THITHI\THITHI-AI\backend\THIHI_AI.Backend
dotnet run
```

- API chạy tại: **http://localhost:5000** (hoặc https://localhost:5001).
- Kiểm tra: mở trình duyệt `http://localhost:5000/api/vectorimport/health` → trả về `{"status":"OK","service":"VectorImportService"}`.

### Bước 2: Khởi động Frontend (Angular)

```powershell
cd D:\Project\thibidi\THITHI\THITHI-AI
npm start
```

- Ứng dụng mở tại **http://localhost:4200** (hoặc port được báo trong terminal).

### Bước 3: (Nếu dùng Python API) Khởi động Python API

```powershell
cd D:\Project\thibidi\THITHI\THITHI_python-api
python app.py
```

- Đảm bảo service lắng nghe tại `http://localhost:5005` (hoặc đúng URL trong `PythonApi:VectorizeUrl`).

### Bước 4: Vào trang Import Excel

1. Mở trình duyệt: **http://localhost:4200**.
2. Vào menu **Import Excel** (route thường là `/import` hoặc link "Import Excel" trên giao diện).

### Bước 5: Chọn file và cấu hình

1. **Chọn file**
   - Bấm **Chọn File** và chọn: `D:\tailieu\aHuy\TS_TONGHOP-2021-test.xlsx`.

2. **Đích import**
   - Chọn: **SQL Server (.NET Backend)**.
   - Đợi đến khi hiển thị **Backend đang hoạt động**.

3. **Tên bảng**
   - Nhập tên bảng trong SQL Server, ví dụ: **TS_TONGHOP** hoặc **TS_TONGHOP_2021**.
   - Lưu ý: tên bảng chỉ được chữ cái, số và dấu gạch dưới (ví dụ `TS_TONGHOP_2021` hợp lệ).

4. **Chọn cột**
   - Sau khi chọn file, hệ thống hiển thị danh sách cột từ header Excel.
   - Chọn các cột cần import (ít nhất một cột).
   - Với từng cột đã chọn, có thể đánh dấu:
     - **Chuẩn hóa cho tính toán (SUM, AVG, etc.)**: các cột số để ChatAI tính toán sau này.
     - **Vectorize (tạo embedding)**: các cột mô tả/văn bản để tìm kiếm theo ý nghĩa.

5. **Preview**
   - Xem bảng preview 10 dòng đầu và tổng số dòng để kiểm tra đúng file.

### Bước 6: Import vào SQL Server

1. Bấm **Import vào SQL Server**.
2. Đợi thanh tiến trình và thông báo **Import thành công**.
3. Nếu lỗi: xem log trong cửa sổ terminal chạy `dotnet run` để biết chi tiết (thiếu cột, lỗi kết nối DB, lỗi Python API, v.v.).

### Bước 7: ChatAI tìm kiếm và tính toán

- Sau khi import xong:
  - Dữ liệu và **vector** đã nằm trong bảng đã chọn (ví dụ **TS_TONGHOP**).
  - **ChatAI** có thể:
    - **Tìm kiếm**: dựa trên vector (semantic search) trong bảng đó.
    - **Tính toán**: dùng các cột đã đánh dấu “Chuẩn hóa cho tính toán” để SUM, AVG, v.v.
- Trong Chat, bạn hỏi tự nhiên về dữ liệu tổng hợp (ví dụ: “Tổng doanh thu năm 2021?”, “Các dòng có mô tả X?”). Hệ thống sẽ tìm trong bảng tương ứng (cần cấu hình Chat biết bảng **TS_TONGHOP** hoặc tên bạn đã đặt).

---

## Import bằng cURL (không dùng giao diện)

Nếu bạn muốn gọi API trực tiếp (file vẫn nằm tại `D:\tailieu\aHuy`):

```powershell
curl -X POST "http://localhost:5000/api/vectorimport/import" `
  -F "file=@D:\tailieu\aHuy\TS_TONGHOP-2021-test.xlsx" `
  -F "tableName=TS_TONGHOP" `
  -F "selectedColumns=Tên cột 1" `
  -F "selectedColumns=Tên cột 2" `
  -F "selectedColumns=Tên cột số"
```

- Thay **Tên cột 1**, **Tên cột 2**, **Tên cột số** bằng đúng tên header trong file Excel.
- Thêm nhiều `-F "selectedColumns=..."` cho từng cột cần import.
- Nếu cần chuẩn hóa cho tính toán và vectorize, có thể thêm (khi backend hỗ trợ):
  - `-F "columnsForCalculation=Tên cột số"`
  - `-F "columnsForVectorization=Tên cột mô tả"`

---

## Cấu trúc bảng sau khi import (tham khảo)

Backend sẽ tạo (hoặc cập nhật) bảng với dạng:

- **ID**: identity.
- **Content**: text gộp từ các cột dùng để vectorize (phục vụ tìm kiếm).
- **VectorJson**: vector embedding (JSON).
- Các cột động theo tên cột Excel bạn chọn (kiểu NVARCHAR(MAX)), phục vụ tính toán và hiển thị.

---

## Xử lý lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| Không kết nối được Backend | Kiểm tra `dotnet run` đang chạy và `backendApiUrl` trong `src/environments/environment.ts` là `http://localhost:5000`. |
| Lỗi kết nối SQL Server | Kiểm tra SQL Server 2025 đang chạy, connection string trong `appsettings.json` đúng (server, database, user, password). |
| “Chỉ chấp nhận file Excel (.xlsx, .xls)” | Đảm bảo file có đuôi `.xlsx` hoặc `.xls`. |
| “Phải chọn ít nhất một cột” | Trong form chọn ít nhất một cột từ file. |
| “Không có dữ liệu hợp lệ để import” | Kiểm tra file có dòng dữ liệu (sau header), và tên cột chọn khớp với header trong Excel (có thể phân biệt dấu cách/viết hoa). |
| Lỗi **"The vector dimensions 384 and 768 do not match"** | Python API trả về vector **384** chiều (ví dụ paraphrase-multilingual-MiniLM) nhưng config đang dùng **768**. Sửa trong `backend\THIHI_AI.Backend\appsettings.json`: đặt `Embedding:Dimension` thành **384**. Nếu bảng đã tạo trước đó với cột `VECTOR(768)`, cần xóa bảng hoặc đổi kiểu cột rồi import lại. |
| Lỗi vectorize (Python API) | Nếu dùng PYTHON_API: kiểm tra Python API chạy đúng port (5005) và `VectorizeUrl` trong `appsettings.json`. |
| Lỗi SQL Server embedding | Nếu dùng SQL_SERVER: kiểm tra đã tạo EXTERNAL MODEL và `Embedding:ModelName` khớp tên model trong SQL Server. |

---

## Tóm tắt nhanh

1. **File**: `D:\tailieu\aHuy\TS_TONGHOP-2021-test.xlsx`.
2. **Backend**: `dotnet run` trong `backend\THIHI_AI.Backend` → `http://localhost:5000`.
3. **Frontend**: `npm start` trong thư mục gốc THITHI-AI → `http://localhost:4200`.
4. **Python API** (nếu dùng): chạy `python app.py` đúng port (5005).
5. Vào **Import Excel** → chọn file → đích **SQL Server** → tên bảng **TS_TONGHOP** (hoặc tên bạn đặt) → chọn cột, đánh dấu **Tính toán** / **Vectorize** → **Import vào SQL Server**.
6. Sau đó ChatAI có thể **tìm kiếm** và **tính toán** trên dữ liệu trong bảng đó.

Nếu bạn gửi thêm ảnh màn hình lỗi hoặc log Backend, có thể xử lý chi tiết từng bước hơn (ví dụ đúng tên cột, tên bảng, connection string).
