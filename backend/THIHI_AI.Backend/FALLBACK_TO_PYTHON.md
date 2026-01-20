# Fallback về Python API - Giải pháp nhanh nhất

## Tình hình hiện tại

SQL Server 2025 ONNX embeddings đang gặp lỗi:
- ❌ "Initialization of the 'AIRuntimeHost' process failed"
- ❌ Cần nhiều cấu hình phức tạp (Machine Learning Services, ONNX Runtime, etc.)

## Giải pháp: Dùng Python API (Đã hoạt động ổn định)

Python API đã được setup và test thành công trước đó. Đây là giải pháp **nhanh nhất và ổn định nhất**.

## Các bước

### Bước 1: Update appsettings.json

```json
{
  "Embedding": {
    "Type": "PYTHON_API",
    "ModelName": ""
  }
}
```

### Bước 2: Start Python API

```bash
cd C:\MyData\projects\THITHI\THITHI_python-api
run-server.bat
```

### Bước 3: Verify Python API

Mở browser: http://localhost:5005/health

Phải trả về:
```json
{
  "status": "OK",
  "service": "Python Vectorize API",
  "model_loaded": true
}
```

### Bước 4: Test Import Excel

Import Excel như bình thường - hệ thống sẽ tự động dùng Python API.

## Lợi ích

✅ **Đã hoạt động** - Python API đã được test và fix trước đó  
✅ **Ổn định** - Không phụ thuộc vào SQL Server AI features  
✅ **Dễ debug** - Logs rõ ràng, dễ troubleshoot  
✅ **Không cần cấu hình phức tạp** - Chỉ cần Python API chạy  

## So sánh

| Feature | SQL Server ONNX | Python API |
|---------|----------------|------------|
| Setup | Phức tạp (cần ML Services, ONNX Runtime) | Đơn giản (chỉ cần Python) |
| Stability | Có thể gặp lỗi AIRuntimeHost | Ổn định |
| Performance | Nhanh (native) | Nhanh (local) |
| Debug | Khó (SQL Server logs) | Dễ (Python logs) |
| Status | ❌ Đang lỗi | ✅ Hoạt động tốt |

## Kết luận

**Khuyến nghị:** Dùng Python API cho đến khi SQL Server ONNX được fix hoàn toàn.

Sau này nếu muốn chuyển sang SQL Server ONNX, chỉ cần:
1. Fix các lỗi AIRuntimeHost
2. Update `appsettings.json` về `"Type": "SQL_SERVER"`
