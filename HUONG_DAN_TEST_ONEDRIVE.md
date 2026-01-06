# 🧪 Hướng dẫn Test OneDrive Integration

## 📋 Bước 1: Kiểm tra cấu hình Azure AD

### 1.1. Kiểm tra API Permissions

1. Vào Azure Portal: https://portal.azure.com
2. Vào **Microsoft Entra ID** > **App registrations**
3. Tìm app: `THITHI AI Outlook Integration`
4. Vào **API permissions**
5. Đảm bảo có các permissions sau:
   - ✅ `User.Read` (Microsoft Graph - Delegated)
   - ✅ `Mail.Read` (Microsoft Graph - Delegated)
   - ✅ `Mail.ReadBasic` (Microsoft Graph - Delegated)
   - ✅ `Files.Read` (Microsoft Graph - Delegated) - **QUAN TRỌNG**
   - ✅ `Files.Read.All` (Microsoft Graph - Delegated) - **QUAN TRỌNG**
   - ✅ `Sites.Read.All` (Microsoft Graph - Delegated) - **QUAN TRỌNG**

6. Nếu thiếu, click **Add a permission** > **Microsoft Graph** > **Delegated permissions** > Tìm và thêm các permissions trên
7. Click **Grant admin consent** (nếu có quyền admin)

### 1.2. Kiểm tra Redirect URI

1. Vào **Authentication** trong App Registration
2. Đảm bảo có Redirect URI: `http://localhost:4200` (cho development)
3. Nếu production, thêm URL production của bạn

## 📋 Bước 2: Chạy ứng dụng

### 2.1. Start Angular app

```bash
npm start
# hoặc
ng serve
```

App sẽ chạy tại: `http://localhost:4200`

### 2.2. Kiểm tra Console

Mở Browser Console (F12) để xem logs

## 📋 Bước 3: Đăng nhập Microsoft

### 3.1. Đăng nhập trong app

1. Mở app: `http://localhost:4200`
2. Click nút **"Outlook"** hoặc **"Microsoft"** trong header
3. Chọn Microsoft account của bạn
4. Cấp quyền khi được hỏi (bao gồm OneDrive permissions)
5. Đợi redirect về app

### 3.2. Kiểm tra token

Mở Browser Console (F12) và chạy:

```javascript
// Kiểm tra token Microsoft
const token = localStorage.getItem('thihi_microsoft_token');
const expiry = localStorage.getItem('thihi_microsoft_token_expiry');

if (token) {
  console.log('✅ Token có:', token.substring(0, 50) + '...');
  console.log('📅 Hết hạn:', expiry ? new Date(parseInt(expiry)).toLocaleString('vi-VN') : 'Không xác định');
} else {
  console.error('❌ Chưa có token. Vui lòng đăng nhập Microsoft.');
}
```

## 📋 Bước 4: Test OneDrive Access

### 4.1. Test trong Browser Console

Chạy script sau trong Console để test OneDrive API:

```javascript
// Test OneDrive Access
const token = localStorage.getItem('thihi_microsoft_token');

if (!token) {
  console.error('❌ Chưa đăng nhập Microsoft. Vui lòng đăng nhập trước.');
} else {
  console.log('🔍 Testing OneDrive access...');
  
  // Test 1: Get recent files
  fetch('https://graph.microsoft.com/v1.0/me/drive/recent', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('✅ OneDrive access OK!');
    console.log('📁 Recent files:', data.value?.length || 0);
    if (data.value && data.value.length > 0) {
      console.log('📄 Sample files:');
      data.value.slice(0, 5).forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} (${file.file?.mimeType || 'unknown'})`);
      });
    }
  })
  .catch(error => {
    console.error('❌ OneDrive access error:', error.message);
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('⚠️ Không có quyền. Vui lòng kiểm tra API permissions trong Azure AD.');
    } else if (error.message.includes('401')) {
      console.error('⚠️ Token hết hạn. Vui lòng đăng nhập lại.');
    }
  });
}
```

### 4.2. Test qua Chat AI

Hỏi AI các câu sau:

#### Test cơ bản:
1. **"Tìm file trong OneDrive của tôi"**
   - AI sẽ liệt kê các file trong OneDrive

2. **"File nào mới nhất trong OneDrive?"**
   - AI sẽ tìm file mới nhất

3. **"Có file Word nào trong drive không?"**
   - AI sẽ tìm file Word

#### Test tìm kiếm:
4. **"Tìm file có tên [tên file]"**
   - Ví dụ: "Tìm file có tên report"

5. **"File Excel nào trong OneDrive?"**
   - AI sẽ tìm file Excel

#### Test tóm tắt:
6. **"Tóm tắt file [tên file] trong OneDrive"**
   - Ví dụ: "Tóm tắt file report.docx trong OneDrive"

7. **"Nội dung file [tên file] là gì?"**
   - AI sẽ đọc và tóm tắt nội dung

8. **"Tóm tắt file PDF trong drive"**
   - AI sẽ tìm và tóm tắt file PDF

## 📋 Bước 5: Kiểm tra Logs

### 5.1. Browser Console Logs

Mở Console (F12) và xem logs khi chat:
- `📁 OneDrive question check:` - Phát hiện câu hỏi về OneDrive
- `📁 Calling searchOneDriveFiles...` - Bắt đầu tìm kiếm
- `📁 searchOneDriveFiles result:` - Kết quả tìm kiếm
- `📄 Starting file summarization:` - Bắt đầu tóm tắt file

### 5.2. Firebase Function Logs

```bash
firebase functions:log --only chatFunction
```

Hoặc xem trong Firebase Console:
1. Vào https://console.firebase.google.com/project/thithi-3e545/functions/logs
2. Chọn function: `chatFunction`
3. Xem logs real-time

## 🐛 Troubleshooting

### Lỗi: "Không có quyền truy cập OneDrive"

**Nguyên nhân:** Chưa cấp quyền Files.Read và Files.Read.All

**Cách fix:**
1. Vào Azure Portal > App Registration
2. API permissions > Thêm `Files.Read` và `Files.Read.All`
3. Grant admin consent
4. Đăng nhập lại Microsoft trong app

### Lỗi: "Token không hợp lệ hoặc đã hết hạn"

**Nguyên nhân:** Token đã hết hạn

**Cách fix:**
1. Đăng xuất Microsoft trong app
2. Đăng nhập lại

### Lỗi: "No files found"

**Nguyên nhân:** OneDrive trống hoặc không có file phù hợp

**Cách fix:**
1. Upload một số file vào OneDrive (Word, Excel, PDF, Text)
2. Thử lại câu hỏi

### Lỗi: "Không thể đọc nội dung file"

**Nguyên nhân:** File bị lỗi hoặc không hỗ trợ

**Cách fix:**
1. Kiểm tra file có đúng định dạng không (.docx, .xlsx, .pdf, .txt)
2. Thử với file khác

## ✅ Checklist Test

- [ ] Azure AD đã cấp quyền Files.Read, Files.Read.All, Sites.Read.All
- [ ] Đã đăng nhập Microsoft trong app
- [ ] Token Microsoft có trong localStorage
- [ ] Test OneDrive API trong Console thành công
- [ ] AI có thể tìm file trong OneDrive
- [ ] AI có thể tóm tắt file Word
- [ ] AI có thể tóm tắt file Excel
- [ ] AI có thể tóm tắt file PDF
- [ ] AI có thể tóm tắt file Text

## 📝 Ghi chú

- OneDrive integration chỉ hoạt động khi đã đăng nhập Microsoft
- File lớn (>10MB) có thể mất thời gian xử lý
- Tóm tắt file sử dụng Gemini API, cần có GEMINI_API_KEY trong Firebase Secrets
- Function logs có thể xem trong Firebase Console để debug

