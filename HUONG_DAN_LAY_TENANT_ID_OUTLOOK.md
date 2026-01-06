# 🔍 Hướng dẫn lấy Tenant ID của Outlook.com Account

## 📋 Cách 1: Lấy Tenant ID từ Browser Console (Nhanh nhất)

### Bước 1: Đăng nhập Outlook.com

1. Mở browser và đăng nhập: https://outlook.com
2. Đăng nhập bằng account: `tungchinhus@outlook.com`

### Bước 2: Lấy Tenant ID từ Token

1. Mở Developer Console: **F12**
2. Vào tab **Console**
3. Copy và paste script sau:

```javascript
// Lấy token từ session (nếu có)
// Hoặc đăng nhập Microsoft và lấy token từ OAuth flow

// Cách 1: Kiểm tra token hiện tại (nếu đã đăng nhập trong app)
const token = localStorage.getItem('thihi_microsoft_token');
if (token) {
  // Decode JWT token để lấy tenant ID
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  
  const payload = JSON.parse(jsonPayload);
  console.log('Token payload:', payload);
  console.log('Tenant ID (tid):', payload.tid);
  console.log('Issuer (iss):', payload.iss);
  
  // Extract tenant ID from issuer
  if (payload.iss) {
    const tenantMatch = payload.iss.match(/https:\/\/sts\.windows\.net\/([^\/]+)\//);
    if (tenantMatch) {
      console.log('✅ Tenant ID từ issuer:', tenantMatch[1]);
    }
  }
} else {
  console.log('Chưa có token. Vui lòng đăng nhập Microsoft trong app trước.');
}
```

### Bước 3: Hoặc lấy từ Graph API

```javascript
// Đăng nhập Microsoft trong app trước
const token = localStorage.getItem('thihi_microsoft_token');

if (token) {
  fetch('https://graph.microsoft.com/v1.0/organization', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(data => {
    console.log('Organization info:', data);
    if (data.value && data.value.length > 0) {
      console.log('✅ Tenant ID:', data.value[0].id);
    } else {
      console.log('⚠️ Personal account - không có organization');
      console.log('👉 Dùng "common" hoặc "consumers" cho personal accounts');
    }
  })
  .catch(err => {
    console.log('⚠️ Personal account - không có organization');
    console.log('👉 Dùng "common" hoặc "consumers" cho personal accounts');
  });
}
```

## 📋 Cách 2: Lấy từ Azure Portal (Nếu có quyền)

1. Đăng nhập Azure Portal: https://portal.azure.com
2. Vào "Microsoft Entra ID" (hoặc "Azure Active Directory")
3. Xem "Overview" → Copy "Tenant ID"

**Lưu ý:** Personal Microsoft accounts (Outlook.com) thường không có Azure AD tenant riêng.

## 📋 Cách 3: Dùng "common" hoặc "consumers" (Khuyến nghị cho Personal Accounts)

Với Outlook.com (personal Microsoft account), nên dùng:
- `"common"` - Hỗ trợ cả organizational và personal accounts
- `"consumers"` - Chỉ personal Microsoft accounts

## ✅ Cập nhật Code

Sau khi có tenant ID, cập nhật `environment.ts`:

```typescript
microsoftTenantId: "common" // Hoặc tenant ID cụ thể nếu có
```

