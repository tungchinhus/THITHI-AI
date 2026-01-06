# Hướng dẫn tích hợp Microsoft Outlook Email

## ✅ Credentials đã được cấu hình

- **Client ID:** `4e8cf90e-655d-4795-9e6d-4bd4353616f3` (trong environment.ts)
- **Tenant ID:** `1c94e0b1-63e3-405f-a00a-54f8138b0811` (trong environment.ts)
- **Client Secret:** `***REDACTED***` (lưu trong Firebase Secrets)

Xem file `MICROSOFT_CREDENTIALS.md` để biết chi tiết.

## Tổng quan

Để AI app có thể đọc email Outlook, chúng ta cần:
1. ✅ Đăng ký ứng dụng trong Azure AD để lấy Client ID và Client Secret (ĐÃ XONG)
2. ✅ Cấu hình OAuth2 để người dùng đăng nhập Microsoft (ĐÃ XONG)
3. ✅ Sử dụng Microsoft Graph API để đọc email (ĐÃ XONG)
4. ✅ Tích hợp vào chat function để AI có thể trả lời về email (ĐÃ XONG)

## Bước 1: Đăng ký ứng dụng trong Azure AD

### 1.1. Tạo Azure AD App Registration

1. **Truy cập Azure Portal:**
   - Vào: https://portal.azure.com
   - Đăng nhập với tài khoản Microsoft

2. **Tạo App Registration:**
   - Tìm "Azure Active Directory" hoặc "Microsoft Entra ID"
   - Vào "App registrations" > "New registration"
   - Đặt tên: `THITHI AI Outlook Integration`
   - Chọn "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: `http://localhost:4200/auth/microsoft/callback` (cho development)
   - Click "Register"

3. **Lấy Client ID và Tenant ID:**
   - Copy **Application (client) ID** → Đây là `MICROSOFT_CLIENT_ID`
   - Copy **Directory (tenant) ID** → Đây là `MICROSOFT_TENANT_ID`

### 1.2. Cấu hình API Permissions

1. Vào "API permissions" > "Add a permission"
2. Chọn "Microsoft Graph" > "Delegated permissions"
3. Thêm các permissions sau:
   - `User.Read` - Đọc thông tin user
   - `Mail.Read` - Đọc email
   - `Mail.ReadBasic` - Đọc thông tin cơ bản email
   - `Mail.ReadWrite` - Đọc và viết email (nếu cần)
   - `offline_access` - Để refresh token

4. Click "Grant admin consent" (nếu có quyền admin)

### 1.3. Tạo Client Secret

1. Vào "Certificates & secrets" > "New client secret"
2. Đặt mô tả: `THITHI AI Secret`
3. Chọn thời hạn (ví dụ: 24 months)
4. Click "Add"
5. **QUAN TRỌNG:** Copy **Value** ngay lập tức (chỉ hiển thị 1 lần) → Đây là `MICROSOFT_CLIENT_SECRET`

### 1.4. Cấu hình Redirect URIs

1. Vào "Authentication" > "Platform configurations"
2. Thêm Redirect URIs (chọn platform type: **Single-page application**):
   - Development: `http://localhost:4200`
   - Production: `https://thithi-app.web.app` hoặc `https://thithi-ai.web.app`

### 1.5. ⚠️ QUAN TRỌNG: Bật Implicit Grant Flow

**Bước này BẮT BUỘC để tránh lỗi AADSTS700051!**

1. Vào "Authentication" trong App Registration
2. Scroll xuống phần **"Implicit grant and hybrid flows"**
3. ✅ **Tick vào "Access tokens"** (ID tokens không cần)
4. Click **"Save"** ở trên cùng
5. Đợi 1-2 phút để Azure cập nhật

**Xem file `FIX_LOI_SSO_OUTLOOK.md` để biết chi tiết.**

## Bước 2: Cấu hình Firebase Secrets

Lưu các thông tin vào Firebase Secrets:

```bash
# Microsoft Client ID (đã cấu hình trong environment.ts, không cần secret)
# Microsoft Client Secret - Lưu vào Firebase Secrets cho backend
# Lấy secret từ Azure Portal > App Registration > Certificates & secrets
echo "YOUR_CLIENT_SECRET" | firebase functions:secrets:set MICROSOFT_CLIENT_SECRET

# Microsoft Tenant ID (đã cấu hình trong environment.ts, không cần secret)
# Nếu cần dùng ở backend, có thể lưu:
echo "1c94e0b1-63e3-405f-a00a-54f8138b0811" | firebase functions:secrets:set MICROSOFT_TENANT_ID
```

**Lưu ý:**
- ✅ Client ID và Tenant ID đã được cấu hình trong `environment.ts` (frontend)
- ✅ Client Secret chỉ dùng ở backend (Firebase Functions) - KHÔNG lưu ở frontend
- ✅ Client Secret cần thiết nếu muốn implement refresh token flow sau này

## Bước 3: Cài đặt Dependencies

Trong thư mục `functions/`:

```bash
cd functions
npm install @azure/msal-node @microsoft/microsoft-graph-client
```

## Bước 4: Cấu hình Frontend

### 4.1. Cập nhật Microsoft Client ID và Tenant ID trong environment

Mở file `src/environments/environment.ts` và `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  // ... other config ...
  microsoftClientId: "YOUR_CLIENT_ID", // Application (client) ID từ Azure AD
  microsoftTenantId: "YOUR_TENANT_ID" // Directory (tenant) ID từ Azure AD
};
```

**Ví dụ với thông tin đã cấu hình:**
```typescript
microsoftClientId: "4e8cf90e-655d-4795-9e6d-4bd4353616f3",
microsoftTenantId: "1c94e0b1-63e3-405f-a00a-54f8138b0811"
```

**Lưu ý:** 
- ✅ Đã được cấu hình sẵn trong code
- ✅ Sử dụng environment variables để bảo mật
- ✅ Cần cập nhật cả `environment.ts` (dev) và `environment.prod.ts` (production)

### 4.2. Cấu hình Redirect URI

Đảm bảo redirect URI trong Azure AD khớp với:
- Development: `http://localhost:4200/auth/microsoft/callback`
- Production: `https://YOUR_DOMAIN.com/auth/microsoft/callback`

## Bước 5: Kiểm tra

1. **Test OAuth flow:**
   - Mở app và click "Đăng nhập Microsoft"
   - Đăng nhập và cấp quyền
   - Kiểm tra token được lưu

2. **Test đọc email:**
   - Hỏi AI: "Tìm email tôi gửi xin nghỉ phép tháng 12"
   - AI sẽ gọi Graph API và trả về kết quả

## Lưu ý bảo mật

- ⚠️ **KHÔNG** commit Client Secret vào Git
- ⚠️ Sử dụng Firebase Secrets để lưu credentials
- ⚠️ Chỉ request permissions cần thiết
- ⚠️ Implement token refresh để tránh hết hạn

## Troubleshooting

### Lỗi: "AADSTS70011: Invalid scope"
- Kiểm tra API permissions đã được grant chưa
- Đảm bảo scope format đúng: `Mail.Read` (không phải `https://graph.microsoft.com/Mail.Read`)

### Lỗi: "AADSTS50020: User account not found"
- Kiểm tra redirect URI đã được cấu hình đúng chưa
- Đảm bảo user đang dùng đúng tenant

### Lỗi: "AADSTS700051: response_type 'token' is not enabled"
- ⚠️ **Lỗi phổ biến nhất!** 
- **Nguyên nhân:** Implicit Grant Flow chưa được bật
- **Giải pháp:** 
  1. Vào Azure Portal > App Registration > Authentication
  2. Scroll xuống "Implicit grant and hybrid flows"
  3. ✅ Tick vào "Access tokens"
  4. Click "Save"
  5. Đợi 1-2 phút và thử lại
- **Xem chi tiết:** File `FIX_LOI_SSO_OUTLOOK.md`

### Lỗi: "403 Forbidden" khi gọi Graph API
- Kiểm tra permissions đã được admin consent chưa
- Kiểm tra token có đúng scope không

