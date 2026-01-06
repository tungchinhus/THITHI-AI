# 🔧 Hướng dẫn cấu hình Redirect URI trong Azure AD

## ❌ Vấn đề hiện tại

Logs cho thấy code đã tạo đúng redirect URI: `http://localhost:4200`
Nhưng Azure AD báo lỗi: "redirect URI does not match"

**Nguyên nhân:** Azure AD chưa có redirect URI `http://localhost:4200` được cấu hình với platform type "Single-page application"

## ✅ Giải pháp: Thêm Redirect URI vào Azure AD

### Bước 1: Truy cập Azure Portal

1. Vào: https://portal.azure.com
2. Đăng nhập với tài khoản Microsoft
3. Tìm "Azure Active Directory" hoặc "Microsoft Entra ID"
4. Click vào

### Bước 2: Vào App Registration

1. Trong menu bên trái, click **"App registrations"**
2. Tìm app: **"THITHI AI Outlook Integration"**
3. Click vào app

### Bước 3: Vào Authentication

1. Trong menu bên trái của app, click **"Authentication"**
2. Scroll xuống phần **"Platform configurations"**

### Bước 4: Thêm Platform "Single-page application"

**Nếu chưa có platform "Single-page application":**

1. Click nút **"+ Add a platform"** (ở trên cùng)
2. Chọn **"Single-page application"**
3. Trong popup, thêm Redirect URI:
   - Nhập: `http://localhost:4200`
   - **KHÔNG** có trailing slash `/`
4. Click **"Configure"**

**Nếu đã có platform "Single-page application":**

1. Tìm platform "Single-page application" trong danh sách
2. Click **"Edit"** hoặc click vào platform đó
3. Trong phần "Redirect URIs", click **"+ Add URI"**
4. Nhập: `http://localhost:4200`
5. Click **"Save"**

### Bước 5: Kiểm tra

Sau khi thêm, bạn sẽ thấy trong table "Redirect URIs":

| Platform Type | Redirect URI |
|---------------|--------------|
| Single-page application | `http://localhost:4200` |
| Single-page application | `https://thithi-app.web.app` |
| Single-page application | `https://thithi-ai.web.app` |

### Bước 6: Lưu và đợi

1. Click **"Save"** ở trên cùng của trang
2. Đợi 1-2 phút để Azure cập nhật
3. Quay lại app và thử đăng nhập lại

## ⚠️ Lưu ý quan trọng

1. **Platform Type:** PHẢI là "Single-page application" (không phải "Web")
   - "Web" platform dùng cho server-side redirect
   - "Single-page application" dùng cho client-side redirect với hash fragment

2. **Redirect URI Format:**
   - ✅ Đúng: `http://localhost:4200` (không có trailing slash)
   - ❌ Sai: `http://localhost:4200/` (có trailing slash)
   - ❌ Sai: `http://localhost:4200/auth/microsoft/callback` (không cần path)

3. **Case Sensitive:**
   - Redirect URI phải khớp chính xác, kể cả case
   - `http://localhost:4200` ≠ `HTTP://LOCALHOST:4200`

4. **Multiple URIs:**
   - Có thể thêm nhiều redirect URIs cho cùng một platform
   - Mỗi URI phải khớp chính xác với URL được gửi trong request

## 🧪 Test sau khi cấu hình

1. Quay lại app: `http://localhost:4200`
2. Click nút "Outlook"
3. Kiểm tra:
   - ✅ Không còn lỗi AADSTS50011
   - ✅ Redirect đến Microsoft login page
   - ✅ Sau khi đăng nhập, quay lại app với token

## 📝 Logs đã xác nhận

Từ logs, code đã tạo đúng redirect URI:
- ✅ `http://localhost:4200` (không có trailing slash)
- ✅ Encoded đúng: `http%3A%2F%2Flocalhost%3A4200`

Vấn đề chỉ là Azure AD config chưa có redirect URI này.

## 🔄 Nếu vẫn lỗi

1. **Kiểm tra lại Azure AD:**
   - Vào Authentication > Platform configurations
   - Đảm bảo có "Single-page application" platform
   - Đảm bảo có redirect URI `http://localhost:4200`

2. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R
   - Hoặc clear cache và cookies

3. **Kiểm tra logs:**
   - Xem `.cursor/debug.log`
   - Đảm bảo redirect URI trong logs là `http://localhost:4200`

4. **Thử với trailing slash:**
   - Nếu vẫn lỗi, thử thêm cả `http://localhost:4200/` vào Azure AD
   - (Nhưng code đã normalize để không có trailing slash)

