# 🔧 Fix lỗi SSO Outlook

## ❌ Lỗi 1: AADSTS700051 (Đã fix)

**AADSTS700051: response_type 'token' is not enabled for the application**

Lỗi này xảy ra vì **Implicit Grant Flow** (response_type=token) chưa được bật trong Azure AD App Registration.

## ❌ Lỗi 2: AADSTS50011 (Redirect URI Mismatch)

**AADSTS50011: The redirect URI 'http://localhost:4200/' specified in the request does not match the redirect URIs configured for the application**

Lỗi này xảy ra vì redirect URI trong code không khớp chính xác với redirect URI đã cấu hình trong Azure AD.

## ❌ Lỗi hiện tại

**AADSTS700051: response_type 'token' is not enabled for the application**

Lỗi này xảy ra vì **Implicit Grant Flow** (response_type=token) chưa được bật trong Azure AD App Registration.

## ✅ Giải pháp: Bật Implicit Grant trong Azure Portal

### Cách 1: Bật Implicit Grant (Nhanh nhất)

1. **Truy cập Azure Portal:**
   - Vào: https://portal.azure.com
   - Đăng nhập với tài khoản Microsoft

2. **Vào App Registration:**
   - Tìm "Azure Active Directory" hoặc "Microsoft Entra ID"
   - Vào "App registrations"
   - Tìm và click vào app: **"THITHI AI Outlook Integration"**

3. **Vào Authentication settings:**
   - Click "Authentication" trong menu bên trái
   - Scroll xuống phần **"Implicit grant and hybrid flows"**

4. **Bật Access tokens:**
   - ✅ Tick vào **"Access tokens"** (ID tokens không cần)
   - Click **"Save"** ở trên cùng

5. **Kiểm tra lại:**
   - Refresh trang và thử đăng nhập lại
   - Lỗi sẽ biến mất

### Cách 2: Chuyển sang Authorization Code Flow (Khuyến nghị - An toàn hơn)

Nếu muốn sử dụng flow an toàn hơn, có thể chuyển sang Authorization Code Flow với PKCE. Tuy nhiên, cách này cần backend để exchange code lấy token.

**Hiện tại:** Code đang dùng Implicit Grant Flow (response_type=token) - phù hợp cho Single Page Application (SPA) không có backend.

## 📝 Hướng dẫn chi tiết với hình ảnh

### Bước 1: Vào Authentication

1. Trong Azure Portal, vào App Registration của bạn
2. Click **"Authentication"** trong menu bên trái
3. Scroll xuống phần **"Implicit grant and hybrid flows"**

### Bước 2: Bật Access tokens

Trong phần "Implicit grant and hybrid flows", bạn sẽ thấy 2 checkbox:
- ☐ **ID tokens** - Không cần (dùng cho OpenID Connect)
- ☐ **Access tokens** - ✅ **CẦN BẬT** (dùng cho OAuth2)

**Làm:**
1. ✅ Tick vào **"Access tokens"**
2. Click nút **"Save"** ở trên cùng của trang

### Bước 3: Đợi vài giây

Sau khi save, đợi 1-2 phút để Azure cập nhật cấu hình.

### Bước 4: Test lại

1. Quay lại app của bạn
2. Click nút "Outlook" để đăng nhập lại
3. Lỗi sẽ không còn xuất hiện

## 🔍 Kiểm tra cấu hình

Sau khi bật, bạn có thể kiểm tra:

1. Vào lại "Authentication" trong Azure Portal
2. Phần "Implicit grant and hybrid flows" sẽ hiển thị:
   - ✅ Access tokens: **Enabled**

## ⚠️ Lưu ý

- **Implicit Grant Flow** phù hợp cho Single Page Application (SPA) như Angular app
- Flow này trả về token trực tiếp trong URL fragment (#access_token=...)
- Không cần backend để exchange code
- **Lưu ý bảo mật:** Token được trả về trong URL, nên đảm bảo:
  - Sử dụng HTTPS trong production
  - Token được lưu an toàn (localStorage)
  - Token có expiration time

## 🚀 Sau khi fix

Sau khi bật Implicit Grant, bạn có thể:

1. ✅ Đăng nhập Microsoft thành công
2. ✅ Nhận access token
3. ✅ Sử dụng token để gọi Microsoft Graph API
4. ✅ Tìm kiếm email qua AI

## 📚 Tài liệu tham khảo

- [Microsoft Docs: Implicit grant flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-implicit-grant-flow)
- [Microsoft Docs: OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

## 🔄 Nếu vẫn lỗi

Nếu sau khi bật vẫn còn lỗi, kiểm tra:

1. **Redirect URI:** Đảm bảo redirect URI khớp chính xác
   - Development: `http://localhost:4200`
   - Production: `https://thithi-app.web.app` hoặc `https://thithi-ai.web.app`

2. **Platform Type:** Đảm bảo redirect URI được cấu hình là **"Single-page application"**

3. **Permissions:** Đảm bảo API permissions đã được grant:
   - `User.Read`
   - `Mail.Read`
   - `Mail.ReadBasic`
   - `offline_access`

4. **Admin Consent:** Nếu là organization account, cần admin consent

---

## 🔧 Fix lỗi AADSTS50011: Redirect URI Mismatch

### Nguyên nhân

Code tạo redirect URI = `window.location.origin + window.location.pathname`
- Nếu ở root path (`/`), redirect URI = `http://localhost:4200/` (có trailing slash)
- Azure AD có thể cấu hình là `http://localhost:4200` (không có trailing slash)
- Azure AD yêu cầu khớp **chính xác 100%**, kể cả trailing slash

### Giải pháp

**Option 1: Normalize redirect URI trong code (Khuyến nghị)**

Cập nhật code để loại bỏ trailing slash:

```typescript
// Normalize redirect URI - remove trailing slash
let redirectUri = window.location.origin + window.location.pathname;
redirectUri = redirectUri.replace(/\/$/, ''); // Remove trailing slash
```

**Option 2: Cập nhật Azure AD Redirect URI**

Thêm redirect URI có trailing slash vào Azure AD:
- `http://localhost:4200/` (với trailing slash)

### Hướng dẫn cập nhật Azure AD

1. Vào Azure Portal > App Registration > "THITHI AI Outlook Integration"
2. Vào "Authentication"
3. Trong phần "Redirect URIs", thêm:
   - ✅ `http://localhost:4200/` (với trailing slash)
   - ✅ `http://localhost:4200` (không có trailing slash) - để đảm bảo cả 2 đều hoạt động
4. Click "Save"

### Kiểm tra

Sau khi fix, redirect URI phải khớp chính xác với một trong các redirect URIs đã cấu hình trong Azure AD.

