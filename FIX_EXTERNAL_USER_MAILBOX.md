# 🔧 Fix: External User không có Mailbox

## ❌ Vấn đề

Từ logs, tôi thấy:
- **User Principal Name:** `tungchinhus_gmail.com#EXT#@tungchinhusgmail.onmicrosoft.com`
- **Mail:** `null`
- **Mail Enabled:** `false`
- **Lỗi:** `MailboxNotEnabledForRESTAPI`

## 🔍 Nguyên nhân

User này là **external user** (Gmail account) được thêm vào Azure AD, nhưng **không có Exchange mailbox**. 

Microsoft Graph API chỉ hỗ trợ:
- ✅ Microsoft 365 mailboxes (Office 365)
- ✅ Outlook.com mailboxes
- ❌ External users (Gmail, Google accounts) - Không có mailbox

## ✅ Giải pháp

### Option 1: Đăng nhập bằng Microsoft 365 Account (Khuyến nghị)

1. **Đăng xuất** khỏi app hiện tại
2. **Đăng nhập lại** bằng Microsoft 365 account hoặc Outlook.com account
3. Account phải có:
   - ✅ Exchange mailbox (không phải external user)
   - ✅ Microsoft 365 license (nếu là business account)
   - ✅ Mailbox được kích hoạt

### Option 2: Tạo Microsoft Account mới

1. Tạo Microsoft account mới tại: https://account.microsoft.com
2. Hoặc tạo Outlook.com email: https://outlook.com
3. Đăng nhập bằng account mới này

### Option 3: Sử dụng Business Microsoft 365 Account

Nếu bạn có Microsoft 365 business account:
1. Đảm bảo account có Exchange Online license
2. Đăng nhập bằng account này
3. Mailbox sẽ có sẵn và hỗ trợ Graph API

## 🔍 Cách kiểm tra

### Trong Browser Console (sau khi đăng nhập):

```javascript
// Lấy token
const token = localStorage.getItem('thihi_microsoft_token');

// Check user info
fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log('User Principal Name:', data.userPrincipalName);
  console.log('Mail:', data.mail);
  console.log('Mail Enabled:', data.mail !== null);
  
  if (data.userPrincipalName && data.userPrincipalName.includes('#EXT#')) {
    console.error('❌ External user - không có mailbox');
  } else if (!data.mail) {
    console.error('❌ Không có mail address');
  } else {
    console.log('✅ Có mailbox');
  }
});
```

## ⚠️ Lưu ý

- **External users (Gmail):** Không thể sử dụng Graph API để đọc email
- **Microsoft 365/Outlook.com:** ✅ Hỗ trợ đầy đủ
- **On-premise Exchange:** ❌ Không hỗ trợ Graph API
- **Hybrid Exchange:** ⚠️ Cần cấu hình đặc biệt

## 📝 Code đã cải thiện

Code đã được cập nhật để:
1. ✅ Phát hiện external users (có `#EXT#` trong userPrincipalName)
2. ✅ Kiểm tra `mail` field (null = không có mailbox)
3. ✅ Error message rõ ràng hơn cho external users
4. ✅ Hướng dẫn user đăng nhập bằng Microsoft 365 account

