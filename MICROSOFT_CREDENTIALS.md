# Microsoft Outlook Credentials - Đã cấu hình

## ✅ Thông tin đã cấu hình

### Frontend (Environment Variables)
- **Client ID:** `4e8cf90e-655d-4795-9e6d-4bd4353616f3`
- **Tenant ID:** `1c94e0b1-63e3-405f-a00a-54f8138b0811`
- **Location:** `src/environments/environment.ts` và `environment.prod.ts`

### Backend (Firebase Secrets)
- **Client Secret:** `***REDACTED***` ✅ Đã lưu (lấy từ Azure Portal)
- **Secret Name:** `MICROSOFT_CLIENT_SECRET`
- **Location:** Firebase Secret Manager

## 🔒 Bảo mật

- ✅ **Client ID & Tenant ID:** Lưu trong environment files (public, OK)
- ✅ **Client Secret:** Lưu trong Firebase Secrets (private, secure)
- ⚠️ **KHÔNG** commit Client Secret vào Git
- ⚠️ **KHÔNG** hardcode Client Secret trong code

## 📝 Sử dụng

### Frontend
```typescript
import { environment } from '../../environments/environment';

const clientId = environment.microsoftClientId;
const tenantId = environment.microsoftTenantId;
```

### Backend (Firebase Functions)
```javascript
// Access secret in function
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const tenantId = process.env.MICROSOFT_TENANT_ID;
```

## 🔄 Refresh Token (Future)

Client Secret sẽ được dùng để implement refresh token flow:
- Khi access token hết hạn
- Tự động refresh mà không cần user đăng nhập lại
- Sử dụng authorization code flow thay vì implicit flow

## 📚 Tài liệu liên quan

- `HUONG_DAN_TICH_HOP_OUTLOOK.md` - Hướng dẫn chi tiết
- `TOM_TAT_TICH_HOP_OUTLOOK.md` - Tóm tắt nhanh

