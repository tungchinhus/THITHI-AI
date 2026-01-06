# 🔧 Setup Development với Personal Outlook.com Account

## 📋 Tình huống

Bạn muốn dùng account cá nhân `tungchinhus@outlook.com` để develop vì không có quyền truy cập tenant của công ty.

## ✅ Giải pháp

### Option 1: Dùng "common" (Khuyến nghị)

**Ưu điểm:**
- ✅ Hỗ trợ cả personal và organizational accounts
- ✅ Không cần lấy tenant ID cụ thể
- ✅ Linh hoạt cho development

**Cách làm:**
1. Cập nhật `environment.ts`:
   ```typescript
   microsoftTenantId: "common"
   ```

2. Cập nhật Azure AD App Registration:
   - Vào Azure Portal
   - App: `THITHI AI Outlook Integration`
   - Authentication → Supported account types
   - Chọn: **"Accounts in any organizational directory and personal Microsoft accounts"**
   - Save

### Option 2: Lấy Tenant ID của Outlook.com Account

**Nếu muốn dùng tenant ID cụ thể:**

1. **Đăng nhập Microsoft trong app** bằng `tungchinhus@outlook.com`

2. **Chạy script trong Console:**
   ```javascript
   const token = localStorage.getItem('thihi_microsoft_token');
   if (token) {
     const base64Url = token.split('.')[1];
     const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
     const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
       return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
     }).join(''));
     
     const payload = JSON.parse(jsonPayload);
     console.log('Tenant ID (tid):', payload.tid);
     
     if (payload.iss) {
       const tenantMatch = payload.iss.match(/https:\/\/sts\.windows\.net\/([^\/]+)\//);
       if (tenantMatch) {
         console.log('✅ Tenant ID:', tenantMatch[1]);
       }
     }
   }
   ```

3. **Copy tenant ID** và cập nhật `environment.ts`:
   ```typescript
   microsoftTenantId: "TENANT_ID_VỪA_LẤY"
   ```

**Lưu ý:** Personal Microsoft accounts thường dùng tenant ID là `9188040d-6c67-4c5b-b112-36a304b66dad` (consumers tenant).

### Option 3: Tạo App Registration mới trong Personal Account (Nếu cần)

**Nếu muốn tách biệt hoàn toàn:**

1. **Tạo Microsoft account mới** (nếu chưa có)
2. **Tạo App Registration mới:**
   - Vào Azure Portal: https://portal.azure.com
   - Đăng nhập bằng personal Microsoft account
   - Vào "Microsoft Entra ID" > "App registrations" > "New registration"
   - Tên: `THITHI AI Personal Development`
   - Supported account types: **"Personal Microsoft accounts only"**
   - Redirect URI: `http://localhost:4200`
   - Register

3. **Lấy Client ID và Tenant ID:**
   - Copy Application (client) ID
   - Copy Directory (tenant) ID (thường là `9188040d-6c67-4c5b-b112-36a304b66dad`)

4. **Cập nhật `environment.ts`:**
   ```typescript
   microsoftClientId: "CLIENT_ID_MỚI"
   microsoftTenantId: "TENANT_ID_MỚI" // Hoặc "common"
   ```

5. **Cấu hình API Permissions:**
   - Vào "API permissions"
   - Add permission → Microsoft Graph → Delegated permissions
   - Thêm: `User.Read`, `Mail.Read`, `Mail.ReadBasic`, `offline_access`
   - Grant admin consent (nếu có)

## 🎯 Khuyến nghị

**Cho development với personal account, tôi khuyến nghị:**

1. ✅ **Dùng `"common"`** trong `microsoftTenantId`
2. ✅ **Cập nhật Azure AD App Registration** để hỗ trợ personal accounts
3. ✅ **Không cần tạo app mới** - dùng app hiện tại

**Lý do:**
- Đơn giản, không cần setup thêm
- Linh hoạt - có thể test với cả personal và organizational accounts
- Dễ chuyển sang production sau này

## 📝 Các bước thực hiện

### Bước 1: Cập nhật Code

File `src/environments/environment.ts` đã được cập nhật:
```typescript
microsoftTenantId: "common"
```

### Bước 2: Cập nhật Azure AD App Registration

1. Vào Azure Portal: https://portal.azure.com
2. Đăng nhập bằng account có quyền admin của tenant `1c94e0b1-63e3-405f-a00a-54f8138b0811`
3. Vào "Microsoft Entra ID" > "App registrations"
4. Tìm app: `THITHI AI Outlook Integration`
5. Vào "Authentication"
6. Supported account types → Chọn: **"Accounts in any organizational directory and personal Microsoft accounts"**
7. Save

### Bước 3: Test

1. **Build và chạy app:**
   ```bash
   ng serve
   ```

2. **Đăng nhập bằng `tungchinhus@outlook.com`:**
   - Click nút "Outlook"
   - Chọn account `tungchinhus@outlook.com`
   - Nếu thành công, sẽ không còn lỗi

3. **Kiểm tra trong Console:**
   ```javascript
   const token = localStorage.getItem('thihi_microsoft_token');
   console.log('Token:', token ? 'Có ✅' : 'Không có ❌');
   ```

4. **Hỏi AI:** "có email mới không?"
   - AI sẽ có thể truy cập email và trả lời

## ⚠️ Lưu ý

- **Personal accounts:** Có thể cần admin consent lần đầu (tự động)
- **Permissions:** Đảm bảo permissions đã được grant
- **Redirect URI:** Phải match chính xác với Azure AD config

## 🆘 Nếu vẫn lỗi

1. **Kiểm tra Supported Account Types** - Phải là multi-tenant
2. **Kiểm tra Redirect URI** - Phải match chính xác
3. **Xem error message** - Có thể có thông tin chi tiết
4. **Thử clear cache:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

