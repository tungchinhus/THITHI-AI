# 🔧 Cập nhật Azure AD App Registration để hỗ trợ Multi-tenant

## ✅ Đã cập nhật Code

Code đã được cập nhật để sử dụng `microsoftTenantId: "common"` thay vì specific tenant ID. Điều này cho phép app hỗ trợ multi-tenant.

## 📋 Cần cập nhật Azure AD App Registration

Để app hoạt động với multi-tenant, cần cập nhật Azure AD App Registration:

### Bước 1: Vào Azure Portal

1. Truy cập: https://portal.azure.com
2. Đăng nhập bằng admin account của tenant `1c94e0b1-63e3-405f-a00a-54f8138b0811`
3. Vào "Microsoft Entra ID" (hoặc "Azure Active Directory")
4. Vào "App registrations"
5. Tìm app: `THITHI AI Outlook Integration` (Client ID: `4e8cf90e-655d-4795-9e6d-4bd4353616f3`)

### Bước 2: Cập nhật Supported Account Types

1. Click vào app
2. Vào **"Authentication"** (bên trái)
3. Tìm section **"Supported account types"**
4. Chọn một trong các options sau:

   **Option A: Multi-tenant (Khuyến nghị)**
   - ✅ **"Accounts in any organizational directory (Any Azure AD directory - Multitenant)"**
   - Cho phép bất kỳ Azure AD account nào đăng nhập
   - Phù hợp cho business apps

   **Option B: Multi-tenant + Personal (Linh hoạt nhất)**
   - ✅ **"Accounts in any organizational directory and personal Microsoft accounts"**
   - Cho phép cả Azure AD accounts và personal Microsoft accounts (Outlook.com, Hotmail, etc.)
   - Phù hợp cho consumer apps

5. Click **"Save"**

### Bước 3: Kiểm tra Redirect URIs

1. Vẫn trong trang "Authentication"
2. Kiểm tra **"Redirect URIs"**
3. Đảm bảo có:
   - `http://localhost:4200` (cho development)
   - Production URL nếu có (ví dụ: `https://yourdomain.com`)

### Bước 4: Kiểm tra API Permissions

1. Vào **"API permissions"** (bên trái)
2. Đảm bảo có các permissions:
   - ✅ `User.Read` (Delegated)
   - ✅ `Mail.Read` (Delegated)
   - ✅ `Mail.ReadBasic` (Delegated)
   - ✅ `offline_access` (Delegated)
3. Nếu có quyền admin, click **"Grant admin consent"**

### Bước 5: Test lại

1. **Build lại app:**
   ```bash
   ng build
   ```

2. **Chạy app:**
   ```bash
   ng serve
   ```

3. **Đăng nhập bằng `chinh.dvt@thibidi.com`:**
   - Click nút "Outlook" trong app
   - Chọn account `chinh.dvt@thibidi.com`
   - Nếu thành công, sẽ không còn lỗi AADSTS50020

4. **Kiểm tra trong Console:**
   ```javascript
   const token = localStorage.getItem('thihi_microsoft_token');
   console.log('Token:', token ? 'Có' : 'Không có');
   ```

## ⚠️ Lưu ý

- **Multi-tenant:** App có thể dùng bởi nhiều tenant, nhưng cần admin consent lần đầu
- **Admin consent:** Nếu account `chinh.dvt@thibidi.com` là lần đầu đăng nhập, có thể cần admin consent
- **Permissions:** Đảm bảo permissions đã được grant cho tenant của user

## 🆘 Nếu vẫn lỗi

Nếu sau khi cập nhật Azure AD mà vẫn lỗi:

1. **Kiểm tra lại Supported Account Types** - Phải là multi-tenant
2. **Kiểm tra Redirect URI** - Phải match chính xác
3. **Kiểm tra Admin Consent** - Có thể cần admin consent cho tenant mới
4. **Xem error message** - Có thể có thông tin chi tiết hơn

## 📝 Tóm tắt

1. ✅ **Code đã cập nhật:** `microsoftTenantId: "common"`
2. 🔧 **Cần làm:** Cập nhật Azure AD App Registration → Supported Account Types → Multi-tenant
3. ✅ **Kết quả:** Bất kỳ Microsoft account nào cũng có thể đăng nhập

