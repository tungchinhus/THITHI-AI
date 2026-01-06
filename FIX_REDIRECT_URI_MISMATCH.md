# 🔧 Fix lỗi AADSTS50011: Redirect URI Mismatch

## ❌ Lỗi

**AADSTS50011: The redirect URI 'http://localhost:4200/' specified in the request does not match the redirect URIs configured for the application**

## 🔍 Nguyên nhân

1. **Trailing Slash Mismatch:**
   - Code tạo redirect URI: `http://localhost:4200/` (có trailing slash)
   - Azure AD cấu hình: `http://localhost:4200` (không có trailing slash)
   - Azure AD yêu cầu khớp **chính xác 100%**

2. **Pathname Issue:**
   - `window.location.pathname` trả về `"/"` khi ở root
   - Kết hợp với `origin` tạo ra URI có trailing slash

## ✅ Giải pháp đã implement

### 1. Normalize Redirect URI trong Code

Code đã được cập nhật để tự động loại bỏ trailing slash:

```typescript
let redirectUri = window.location.origin + window.location.pathname;
redirectUri = redirectUri.replace(/\/$/, ''); // Remove trailing slash
```

**Kết quả:**
- `http://localhost:4200/` → `http://localhost:4200` ✅
- `http://localhost:4200` → `http://localhost:4200` ✅

### 2. Cấu hình Azure AD Redirect URI (QUAN TRỌNG!)

**⚠️ Lỗi vẫn xảy ra vì Azure AD chưa có redirect URI `http://localhost:4200` được cấu hình!**

**Bước 1: Vào Azure Portal**
1. Truy cập: https://portal.azure.com
2. Đăng nhập với tài khoản Microsoft
3. Vào "Azure Active Directory" hoặc "Microsoft Entra ID"
4. Vào "App registrations"
5. Tìm và click vào app: **"THITHI AI Outlook Integration"**

**Bước 2: Thêm Redirect URI**
1. Click **"Authentication"** trong menu bên trái
2. Trong phần **"Platform configurations"**, click **"+ Add a platform"**
3. Chọn **"Single-page application"**
4. Trong phần **"Redirect URIs"**, thêm:
   - ✅ `http://localhost:4200` (không có trailing slash) - **QUAN TRỌNG!**
   - ✅ `https://thithi-app.web.app` (production)
   - ✅ `https://thithi-ai.web.app` (production)
5. Click **"Configure"** để lưu platform
6. Click **"Save"** ở trên cùng

**Bước 3: Kiểm tra lại**
1. Trong "Redirect URIs" table, đảm bảo thấy:
   - Platform Type: **Single-page application**
   - Redirect URI: `http://localhost:4200`
2. Nếu không thấy, thêm lại theo Bước 2

**⚠️ LƯU Ý QUAN TRỌNG:**
- Platform Type **PHẢI** là "Single-page application" (không phải "Web")
- Redirect URI **PHẢI** là `http://localhost:4200` (không có trailing slash `/`)
- Đảm bảo click "Save" sau khi thêm

## 🧪 Test

1. Chạy app: `npm start` hoặc `ng serve`
2. Click nút "Outlook"
3. Kiểm tra console logs để xem redirect URI được tạo
4. Đăng nhập Microsoft
5. Lỗi AADSTS50011 sẽ không còn xuất hiện

## 📝 Logging

Code đã có logging để debug:
- Log redirect URI trước và sau khi normalize
- Log origin, pathname, full URL
- Log encoded redirect URI trong auth URL

Xem logs trong: `.cursor/debug.log`

## ⚠️ Lưu ý

- Redirect URI phải khớp **chính xác** với Azure AD config
- Cả trailing slash và không có trailing slash đều phải được xử lý
- Code đã normalize để loại bỏ trailing slash tự động
- Azure AD config nên dùng **không có trailing slash** (chuẩn hơn)

## 🔄 Nếu vẫn lỗi

1. **Kiểm tra Azure AD config:**
   - Vào Authentication > Redirect URIs
   - Đảm bảo có `http://localhost:4200` (không có `/` ở cuối)

2. **Kiểm tra logs:**
   - Xem `.cursor/debug.log`
   - Tìm "Redirect URI normalized"
   - Kiểm tra giá trị `redirectUri` có đúng không

3. **Clear cache:**
   - Clear browser cache
   - Hard refresh (Ctrl+Shift+R)
   - Thử lại

4. **Kiểm tra Platform Type:**
   - Đảm bảo redirect URI được cấu hình là **"Single-page application"**

