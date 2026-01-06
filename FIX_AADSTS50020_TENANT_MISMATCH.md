# 🔧 Fix: Lỗi AADSTS50020 - Tenant Mismatch

## ❌ Vấn đề

Khi đăng nhập với account `chinh.dvt@thibidi.com`, gặp lỗi:

```
AADSTS50020: User account 'chinh.dvt@thibidi.com' from identity provider 
'https://sts.windows.net/947b0330-c10e-4466-ba8c-8293d24858f7/' 
does not exist in tenant 'Default Directory' and cannot access the application.
```

## 🔍 Nguyên nhân

1. **Account `chinh.dvt@thibidi.com`** thuộc tenant khác: `947b0330-c10e-4466-ba8c-8293d24858f7`
2. **App được đăng ký** trong tenant: `1c94e0b1-63e3-405f-a00a-54f8138b0811`
3. **Account không có trong tenant của app** → Không thể truy cập app

## ✅ Giải pháp

### Option 1: Thêm Account như External User (Cần Admin)

**Nếu bạn là admin của tenant `1c94e0b1-63e3-405f-a00a-54f8138b0811`:**

1. **Vào Azure Portal:**
   - https://portal.azure.com
   - Đăng nhập bằng admin account của tenant `1c94e0b1-63e3-405f-a00a-54f8138b0811`

2. **Thêm External User:**
   - Vào "Microsoft Entra ID" > "Users"
   - Click "New guest user"
   - Email: `chinh.dvt@thibidi.com`
   - Click "Invite"
   - User sẽ nhận email invitation

3. **Accept invitation:**
   - User `chinh.dvt@thibidi.com` cần accept invitation
   - Sau đó có thể đăng nhập vào app

### Option 2: Thay đổi App Registration để hỗ trợ Multi-tenant (Khuyến nghị)

**Nếu bạn muốn app hỗ trợ nhiều tenant:**

1. **Vào Azure Portal:**
   - https://portal.azure.com
   - Vào "Microsoft Entra ID" > "App registrations"
   - Tìm app: `THITHI AI Outlook Integration` (Client ID: `4e8cf90e-655d-4795-9e6d-4bd4353616f3`)

2. **Thay đổi Supported account types:**
   - Vào "Authentication"
   - Tìm "Supported account types"
   - Chọn: **"Accounts in any organizational directory and personal Microsoft accounts"**
   - Hoặc: **"Accounts in any organizational directory (Any Azure AD directory - Multitenant)"**
   - Click "Save"

3. **Update Redirect URIs nếu cần:**
   - Đảm bảo redirect URI phù hợp với multi-tenant

4. **Update code (nếu cần):**
   - Kiểm tra `microsoftTenantId` trong `environment.ts`
   - Có thể cần đổi từ specific tenant ID sang `common` hoặc `organizations`

### Option 3: Đăng nhập bằng Account trong cùng Tenant

**Nếu bạn có account trong tenant `1c94e0b1-63e3-405f-a00a-54f8138b0811`:**

1. **Đăng nhập bằng account đó** thay vì `chinh.dvt@thibidi.com`
2. **Hoặc tạo account mới** trong tenant này

### Option 4: Thay đổi Tenant ID trong Code (Nếu bạn muốn dùng tenant khác)

**Nếu bạn muốn app dùng tenant của `chinh.dvt@thibidi.com`:**

1. **Update `environment.ts`:**
   ```typescript
   microsoftTenantId: "947b0330-c10e-4466-ba8c-8293d24858f7" // Tenant của thibidi.com
   ```

2. **Update App Registration:**
   - Cần đăng ký app trong tenant mới
   - Hoặc move app sang tenant mới

## 🔍 Cách kiểm tra Tenant ID

### Kiểm tra Tenant ID của Account:

1. **Đăng nhập Azure Portal** bằng account `chinh.dvt@thibidi.com`
2. **Vào "Microsoft Entra ID"** (hoặc "Azure Active Directory")
3. **Xem "Overview"** → Copy "Tenant ID"

### Kiểm tra Tenant ID của App:

1. **Vào Azure Portal** bằng admin account của tenant app
2. **Vào "Microsoft Entra ID" > "App registrations"**
3. **Tìm app** `THITHI AI Outlook Integration`
4. **Xem "Overview"** → Copy "Directory (tenant) ID"

## 📝 Code hiện tại

Trong `src/environments/environment.ts`:
```typescript
microsoftTenantId: "1c94e0b1-63e3-405f-a00a-54f8138b0811" // Tenant của app
```

Account `chinh.dvt@thibidi.com` thuộc tenant: `947b0330-c10e-4466-ba8c-8293d24858f7`

## ✅ Giải pháp nhanh nhất

**Nếu bạn muốn dùng account `chinh.dvt@thibidi.com` ngay:**

1. **Option 2 (Multi-tenant)** - Khuyến nghị nhất:
   - Thay đổi app registration để hỗ trợ multi-tenant
   - Không cần thêm external user
   - Bất kỳ Microsoft account nào cũng có thể đăng nhập

2. **Hoặc Option 1 (External User)**:
   - Admin thêm `chinh.dvt@thibidi.com` như guest user
   - User accept invitation
   - Sau đó có thể đăng nhập

## 🧪 Test sau khi fix

1. **Đăng nhập lại** bằng `chinh.dvt@thibidi.com`
2. **Kiểm tra token** trong Console:
   ```javascript
   const token = localStorage.getItem('thihi_microsoft_token');
   console.log('Token:', token ? 'Có' : 'Không có');
   ```
3. **Hỏi AI:** "có email mới không?"
4. **Kiểm tra response** - AI sẽ có thể truy cập email

## ⚠️ Lưu ý

- **Multi-tenant:** App có thể dùng bởi nhiều tenant, nhưng cần cấu hình đúng
- **Single-tenant:** App chỉ dùng bởi 1 tenant, account phải trong tenant đó
- **External users:** Cần được thêm như guest user trước khi đăng nhập

