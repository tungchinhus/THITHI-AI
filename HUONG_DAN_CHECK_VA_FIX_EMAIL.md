# 🔍 Hướng dẫn Check và Fix Email Access

## 📋 Bước 1: Kiểm tra loại Account đang dùng

### 1.1. Mở Browser Console

1. Mở app: `http://localhost:4200`
2. Mở Developer Console: **F12** hoặc **Ctrl+Shift+I**
3. Vào tab **Console**

### 1.2. Chạy script kiểm tra

Copy và paste script sau vào Console:

```javascript
// Lấy token từ localStorage
const token = localStorage.getItem('thihi_microsoft_token');

if (!token) {
  console.error('❌ Chưa đăng nhập Microsoft. Vui lòng đăng nhập trước.');
} else {
  console.log('✅ Đã có token Microsoft');
  console.log('Token length:', token.length);
  console.log('Token preview:', token.substring(0, 50) + '...');
  
  // Test Graph API - Get user info
  fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    return response.json();
  })
  .then(userInfo => {
    console.log('\n=== 👤 USER INFO ===');
    console.log('Display Name:', userInfo.displayName);
    console.log('User Principal Name:', userInfo.userPrincipalName);
    console.log('Mail:', userInfo.mail);
    console.log('Mail Enabled:', userInfo.mail !== null && userInfo.mail !== undefined);
    
    // Check if external user
    if (userInfo.userPrincipalName && userInfo.userPrincipalName.includes('#EXT#')) {
      console.error('\n❌ EXTERNAL USER DETECTED!');
      console.error('User này là external user (Gmail/Google account) và KHÔNG có Exchange mailbox.');
      console.error('Giải pháp: Đăng nhập bằng Microsoft 365 account hoặc Outlook.com account.');
    } else if (!userInfo.mail) {
      console.warn('\n⚠️ WARNING: Không có mail address');
      console.warn('User có thể không có Exchange mailbox.');
    } else {
      console.log('\n✅ User có mail address:', userInfo.mail);
    }
    
    // Test mailbox settings
    return fetch('https://graph.microsoft.com/v1.0/me/mailboxSettings', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        const errorText = text;
        console.error('\n❌ MAILBOX SETTINGS ERROR:');
        console.error('Status:', response.status);
        console.error('Error:', errorText);
        
        if (errorText.includes('on-premise') || 
            errorText.includes('inactive') ||
            errorText.includes('soft-deleted') ||
            errorText.includes('MailboxNotEnabledForRESTAPI')) {
          console.error('\n❌ MAILBOX KHÔNG KHẢ DỤNG CHO REST API');
          console.error('Có thể do:');
          console.error('1. Mailbox là on-premise Exchange');
          console.error('2. Mailbox chưa được kích hoạt cho REST API');
          console.error('3. User không có Microsoft 365 license');
          console.error('4. Mailbox bị soft-deleted hoặc inactive');
        }
        throw new Error(errorText);
      });
    }
    return response.json();
  })
  .then(mailboxSettings => {
    console.log('\n✅ MAILBOX SETTINGS:');
    console.log('Time Zone:', mailboxSettings.timeZone);
    console.log('Language:', mailboxSettings.language);
    console.log('\n✅ Mailbox hỗ trợ Graph API!');
    
    // Test getting emails
    return fetch('https://graph.microsoft.com/v1.0/me/messages?$top=5&$orderby=receivedDateTime desc', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        console.error('\n❌ GET MESSAGES ERROR:');
        console.error('Status:', response.status);
        console.error('Error:', text);
        throw new Error(text);
      });
    }
    return response.json();
  })
  .then(emails => {
    console.log('\n✅ EMAILS:');
    console.log('Total emails found:', emails.value?.length || 0);
    if (emails.value && emails.value.length > 0) {
      console.log('\nRecent emails:');
      emails.value.slice(0, 3).forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject || '(No subject)'} - From: ${email.from?.emailAddress?.address || 'Unknown'}`);
      });
    }
    console.log('\n✅ SUCCESS! Mailbox hoạt động bình thường với Graph API.');
  })
  .catch(error => {
    console.error('\n❌ ERROR:', error.message);
  });
}
```

### 1.3. Phân tích kết quả

Sau khi chạy script, bạn sẽ thấy một trong các trường hợp sau:

#### ✅ Case 1: External User (Gmail account)
```
❌ EXTERNAL USER DETECTED!
User này là external user (Gmail/Google account) và KHÔNG có Exchange mailbox.
```
**Giải pháp:** Xem Bước 2.1

#### ✅ Case 2: Không có Mail Address
```
⚠️ WARNING: Không có mail address
```
**Giải pháp:** Xem Bước 2.2

#### ✅ Case 3: Mailbox Not Enabled for REST API
```
❌ MAILBOX KHÔNG KHẢ DỤNG CHO REST API
```
**Giải pháp:** Xem Bước 2.3

#### ✅ Case 4: Success
```
✅ Mailbox hỗ trợ Graph API!
✅ SUCCESS! Mailbox hoạt động bình thường với Graph API.
```
**Kết quả:** Mailbox hoạt động tốt! Nếu app vẫn không hoạt động, xem Bước 3.

---

## 🔧 Bước 2: Fix theo từng trường hợp

### 2.1. Fix External User (Gmail account)

**Vấn đề:** Đang dùng Gmail account được thêm vào Azure AD, không có Exchange mailbox.

**Giải pháp:**

1. **Đăng xuất khỏi app:**
   - Click nút "Đăng xuất" trong app
   - Hoặc xóa token: Trong Console, chạy:
     ```javascript
     localStorage.removeItem('thihi_microsoft_token');
     localStorage.removeItem('thihi_microsoft_token_expiry');
     location.reload();
     ```

2. **Đăng nhập lại bằng Microsoft 365/Outlook.com:**
   - Click nút "Outlook" trong app
   - Chọn **Microsoft 365 account** hoặc **Outlook.com account**
   - **KHÔNG** chọn Gmail account

3. **Kiểm tra lại:**
   - Chạy lại script ở Bước 1.2
   - Đảm bảo không còn `#EXT#` trong User Principal Name
   - Đảm bảo có `mail` address

### 2.2. Fix Không có Mail Address

**Vấn đề:** User không có mail address trong Azure AD.

**Giải pháp:**

1. **Kiểm tra trong Azure Portal:**
   - Vào: https://portal.azure.com
   - Vào "Microsoft Entra ID" > "Users"
   - Tìm user của bạn
   - Kiểm tra xem có "Mail" field không

2. **Nếu là Business Account:**
   - Liên hệ IT admin để:
     - Assign Microsoft 365 license
     - Enable Exchange mailbox
     - Set mail address

3. **Nếu là Personal Account:**
   - Tạo Outlook.com account mới: https://outlook.com
   - Đăng nhập bằng account mới

### 2.3. Fix Mailbox Not Enabled for REST API

**Vấn đề:** Mailbox là on-premise Exchange hoặc chưa được kích hoạt.

**Giải pháp:**

1. **Nếu là On-premise Exchange:**
   - ❌ Không thể fix bằng code
   - Cần migrate mailbox lên Exchange Online
   - Hoặc cấu hình hybrid Exchange với REST API
   - Liên hệ IT admin

2. **Nếu là Cloud Mailbox nhưng chưa kích hoạt:**
   - Liên hệ IT admin để:
     - Enable REST API cho mailbox
     - Assign Microsoft 365 license
     - Verify mailbox status

---

## 🧪 Bước 3: Test lại sau khi Fix

### 3.1. Test trong App

1. **Đảm bảo đã đăng nhập đúng account:**
   - Account phải có Exchange mailbox
   - Không phải external user

2. **Test trong chat:**
   - Hỏi: "có email mới không?"
   - Hoặc: "có email nào mới gửi hôm nay không?"

3. **Quan sát response:**
   - ✅ Nếu AI trả lời về email thực tế → **SUCCESS!**
   - ❌ Nếu AI vẫn báo lỗi → Xem Bước 3.2

### 3.2. Xem Firebase Logs

Nếu vẫn lỗi, xem logs để debug:

```bash
firebase functions:log
```

Tìm logs với prefix:
- `👤 User info` - Xem user info
- `📬 Mailbox settings` - Xem mailbox settings
- `❌ Error` - Xem lỗi chi tiết

### 3.3. Test trực tiếp Graph API

Nếu app vẫn không hoạt động nhưng script ở Bước 1.2 thành công:

1. **Kiểm tra token có được gửi từ frontend không:**
   - Mở Network tab (F12)
   - Gửi message trong app
   - Xem request payload
   - Đảm bảo có `microsoftAccessToken` field

2. **Kiểm tra backend có nhận được token không:**
   - Xem Firebase logs
   - Tìm log: `📥 Backend received request`
   - Đảm bảo `hasToken: true`

---

## 📝 Checklist

Trước khi báo lỗi, đảm bảo:

- [ ] Đã chạy script kiểm tra ở Bước 1.2
- [ ] Đã xem kết quả và xác định vấn đề
- [ ] Đã thử fix theo hướng dẫn ở Bước 2
- [ ] Đã test lại sau khi fix
- [ ] Đã xem Firebase logs nếu vẫn lỗi
- [ ] Đã kiểm tra token có được gửi từ frontend không

---

## 🆘 Vẫn không hoạt động?

Nếu đã làm tất cả các bước trên mà vẫn không hoạt động:

1. **Copy toàn bộ output từ script ở Bước 1.2**
2. **Copy Firebase logs** (từ `firebase functions:log`)
3. **Mô tả chi tiết:**
   - Account type (Microsoft 365, Outlook.com, Gmail, etc.)
   - Kết quả từ script
   - Response từ AI
   - Bất kỳ error messages nào

Gửi thông tin này để được hỗ trợ thêm.

