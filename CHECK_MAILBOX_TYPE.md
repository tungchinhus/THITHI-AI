# 🔍 Cách kiểm tra loại Mailbox (On-premise vs Cloud)

## 📋 Kiểm tra trong Azure Portal

### Bước 1: Vào Azure Portal
1. Truy cập: https://portal.azure.com
2. Đăng nhập với tài khoản Microsoft

### Bước 2: Kiểm tra User
1. Vào **"Microsoft Entra ID"** (hoặc "Azure Active Directory")
2. Vào **"Users"**
3. Tìm và click vào user của bạn

### Bước 3: Xem thông tin Mailbox
Trong trang user, kiểm tra:
- **Mail:** Có email address không?
- **Mailbox location:** 
  - Nếu là **"Exchange Online"** → ✅ Cloud mailbox (hỗ trợ Graph API)
  - Nếu là **"On-premises"** → ❌ On-premise mailbox (không hỗ trợ Graph API)
- **Licenses:** Có Microsoft 365 license không?

## 📋 Kiểm tra bằng PowerShell (nếu có quyền Admin)

```powershell
# Kết nối Exchange Online
Connect-ExchangeOnline

# Kiểm tra mailbox
Get-Mailbox -Identity "user@domain.com" | Select-Object DisplayName, RecipientTypeDetails, PrimarySmtpAddress, ExchangeVersion

# Nếu ExchangeVersion là "0.0" hoặc không có → On-premise
# Nếu ExchangeVersion có giá trị → Exchange Online
```

## 📋 Kiểm tra bằng Microsoft Graph API

Có thể test trực tiếp trong browser console sau khi đăng nhập:

```javascript
// Lấy token từ localStorage
const token = localStorage.getItem('thihi_microsoft_token');

// Test Graph API
fetch('https://graph.microsoft.com/v1.0/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('User info:', data);
  console.log('Mail:', data.mail);
  console.log('User Principal Name:', data.userPrincipalName);
});

// Test mailbox settings
fetch('https://graph.microsoft.com/v1.0/me/mailboxSettings', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => {
  if (r.ok) {
    return r.json();
  } else {
    return r.text().then(text => {
      throw new Error(text);
    });
  }
})
.then(data => {
  console.log('✅ Mailbox settings:', data);
  console.log('✅ Mailbox is cloud-based and supports Graph API');
})
.catch(error => {
  console.error('❌ Mailbox error:', error);
  if (error.message.includes('on-premise') || 
      error.message.includes('inactive') ||
      error.message.includes('MailboxNotEnabledForRESTAPI')) {
    console.error('❌ Mailbox is on-premise or not enabled for REST API');
  }
});
```

## 🔧 Cách fix nếu là On-premise

### Option 1: Migrate lên Exchange Online (Khuyến nghị)
1. Liên hệ IT admin để migrate mailbox lên Exchange Online
2. Sau khi migrate, mailbox sẽ hỗ trợ Graph API

### Option 2: Sử dụng Exchange Web Services (EWS)
- On-premise Exchange hỗ trợ EWS API
- Cần cấu hình lại code để sử dụng EWS thay vì Graph API
- Phức tạp hơn và cần thêm cấu hình

### Option 3: Hybrid Exchange với REST API
- Cấu hình Exchange hybrid
- Enable REST API cho on-premise mailboxes
- Cần quyền admin và cấu hình phức tạp

## ⚠️ Lưu ý

- **On-premise Exchange:** Không thể fix bằng code, cần migrate hoặc cấu hình
- **Cloud mailbox nhưng vẫn lỗi:** Có thể do license hoặc mailbox chưa được kích hoạt
- **Test trong browser console:** Cách nhanh nhất để kiểm tra mailbox type

