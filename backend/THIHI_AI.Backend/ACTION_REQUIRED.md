# ⚠️ ACTION REQUIRED - Fix ONNX Kill State Error

## Vấn đề

Lỗi **"Cannot continue the execution because the session is in the kill state"** khi chạy `AI_GENERATE_EMBEDDINGS`.

## Nguyên nhân có thể

1. **Thiếu ONNX Runtime DLLs** (khả năng cao nhất)
2. File ONNX không đúng format
3. SQL Server không thể truy cập file

## Giải pháp nhanh nhất

### Option 1: Thử với LOCAL_RUNTIME_PATH (Khuyến nghị)

1. **Download ONNX Runtime:**
   - Link: https://github.com/microsoft/onnxruntime/releases
   - Tìm version mới nhất (>= 1.19)
   - Download **Windows x64** version
   - Extract file `onnxruntime.dll`

2. **Tạo thư mục và copy DLL:**
   ```powershell
   New-Item -ItemType Directory -Path "C:\onnx_runtime" -Force
   # Copy onnxruntime.dll vào C:\onnx_runtime\
   ```

3. **Set permissions:**
   ```powershell
   icacls "C:\onnx_runtime" /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)R" /T
   ```

4. **Chạy script mới:**
   - Mở file `CREATE_ONNX_MODEL_WITH_RUNTIME.sql`
   - Chạy script

### Option 2: Kiểm tra SQL Server Error Log

1. Mở **SQL Server Management Studio**
2. Vào **Management > SQL Server Logs**
3. Xem log mới nhất để tìm lỗi chi tiết về ONNX
4. Tìm các dòng có chứa "ONNX", "embedding_model", hoặc "local_onnx_embeddings"

### Option 3: Fallback về Python API (Tạm thời)

Nếu ONNX vẫn không hoạt động, có thể dùng Python API tạm thời:

1. **Update appsettings.json:**
   ```json
   {
     "Embedding": {
       "Type": "PYTHON_API",
       "ModelName": ""
     }
   }
   ```

2. **Start Python API:**
   ```bash
   cd C:\MyData\projects\THITHI\THITHI_python-api
   run-server.bat
   ```

3. **Test import Excel** - Sẽ dùng Python API thay vì SQL Server

## Files đã tạo

- ✅ `DEBUG_ONNX_ERROR.sql` - Script debug
- ✅ `CREATE_ONNX_MODEL_WITH_RUNTIME.sql` - Script với LOCAL_RUNTIME_PATH
- ✅ `FIX_ONNX_KILL_STATE.md` - Hướng dẫn chi tiết

## Next Steps

1. **Thử Option 1 trước** (download ONNX Runtime DLLs)
2. Nếu vẫn lỗi, **kiểm tra SQL Server Error Log** (Option 2)
3. Nếu vẫn không được, **fallback về Python API** (Option 3) để tiếp tục công việc

## Lưu ý

- ONNX Runtime DLLs có thể cần thiết tùy vào cấu hình SQL Server 2025
- Một số version SQL Server 2025 có thể không yêu cầu LOCAL_RUNTIME_PATH
- Nếu SQL Server Error Log không có thông tin, có thể cần enable verbose logging
