# Fix Lỗi "Initialization of the 'AIRuntimeHost' process failed"

## Lỗi

```
Msg 31738, Level 17, State 13
Initialization of the 'AIRuntimeHost' process failed with HRESULT 0x80004004
```

## Nguyên nhân

HRESULT 0x80004004 thường là **E_ABORT** - operation aborted. Có thể do:

1. **SQL Server Launchpad service chưa chạy hoặc có vấn đề**
2. **Machine Learning Services chưa được cài đặt hoặc enable**
3. **ONNX Runtime DLL không tương thích với SQL Server 2025**
4. **Thiếu dependencies cho ONNX Runtime**

## Giải pháp

### Giải pháp 1: Kiểm tra và Start SQL Server Launchpad Service

1. **Mở Services (services.msc)**
2. **Tìm service:** `SQL Server Launchpad (MSSQLSERVER)` hoặc `SQL Server Launchpad (MSSQL$INSTANCENAME)`
3. **Kiểm tra Status:**
   - Nếu **Stopped**: Click **Start**
   - Nếu **Running**: Thử **Restart**

4. **Hoặc dùng PowerShell:**
   ```powershell
   # Kiểm tra service
   Get-Service | Where-Object {$_.Name -like "*Launchpad*"}
   
   # Start service (nếu stopped)
   Start-Service "MSSQLSERVER$INSTANCENAME" -Name "*Launchpad*"
   ```

### Giải pháp 2: Kiểm tra Machine Learning Services

SQL Server 2025 cần **Machine Learning Services** để chạy AI features:

1. **Kiểm tra xem đã cài chưa:**
   ```sql
   EXEC sp_configure 'external scripts enabled';
   EXEC sp_configure 'external AI runtimes enabled';
   ```

2. **Nếu chưa enable, chạy:**
   ```sql
   EXEC sp_configure 'external scripts enabled', 1;
   EXEC sp_configure 'external AI runtimes enabled', 1;
   RECONFIGURE WITH OVERRIDE;
   ```

3. **Restart SQL Server service** sau khi enable

### Giải pháp 3: Kiểm tra ONNX Runtime Version

ONNX Runtime có thể không tương thích. Thử:

1. **Download ONNX Runtime version khác:**
   - Thử version **1.19.x** (stable)
   - Hoặc version mới nhất từ GitHub releases

2. **Kiểm tra architecture:**
   - Phải là **Windows x64** (không phải x86)
   - Phải match với SQL Server architecture

### Giải pháp 4: Fallback về Python API (Khuyến nghị)

Nếu ONNX vẫn không hoạt động sau các bước trên, **fallback về Python API** là giải pháp ổn định nhất:

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

### Giải pháp 5: Dùng Azure OpenAI (Nếu có)

Nếu có Azure OpenAI, có thể dùng Azure OpenAI thay vì ONNX local:

1. **Tạo EXTERNAL MODEL với Azure OpenAI** (xem `CREATE_EXTERNAL_MODEL.sql`)
2. **Update appsettings.json:**
   ```json
   {
     "Embedding": {
       "Type": "SQL_SERVER",
       "ModelName": "azure_openai_embeddings"
     }
   }
   ```

## Checklist

- [ ] SQL Server Launchpad service đang chạy
- [ ] Machine Learning Services đã được enable
- [ ] External scripts enabled = 1
- [ ] External AI runtimes enabled = 1
- [ ] SQL Server đã được restart sau khi enable
- [ ] ONNX Runtime DLL đúng version và architecture

## Khuyến nghị

**Nếu đang trong môi trường production hoặc cần hoạt động ngay:**

→ **Fallback về Python API** (Giải pháp 4) là nhanh nhất và ổn định nhất.

**Nếu muốn tiếp tục debug ONNX:**

→ Thử các giải pháp 1-3 theo thứ tự, kiểm tra SQL Server Error Log sau mỗi bước.
