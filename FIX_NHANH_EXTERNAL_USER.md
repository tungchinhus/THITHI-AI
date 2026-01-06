# ⚡ Fix Nhanh: External User (Gmail Account)

## ✅ Đã xác định vấn đề

Từ kết quả kiểm tra:
- ❌ **User Principal Name:** `tungchinhus_gmail.com#EXT#@tungchinhusgmail.onmicrosoft.com`
- ❌ **Mail:** `null`
- ❌ **Mail Enabled:** `false`
- ❌ **Lỗi:** `MailboxNotEnabledForRESTAPI`

**Kết luận:** Bạn đang dùng **Gmail account** (external user) và **KHÔNG có Exchange mailbox**.

## 🔧 Cách Fix (3 bước đơn giản)

### Bước 1: Đăng xuất khỏi app

**Cách 1: Dùng Console (Nhanh nhất)**
1. Mở Developer Console: **F12**
2. Vào tab **Console**
3. Copy và paste:
   ```javascript
   localStorage.removeItem('thihi_microsoft_token');
   localStorage.removeItem('thihi_microsoft_token_expiry');
   location.reload();
   ```

**Cách 2: Dùng UI**
1. Trong app, tìm nút "Đăng xuất" hoặc "Logout"
2. Click để đăng xuất

### Bước 2: Đăng nhập lại bằng Microsoft 365/Outlook.com

1. **Trong app, click nút "Outlook"** để đăng nhập Microsoft
2. **QUAN TRỌNG:** Khi Microsoft hỏi chọn account:
   - ❌ **KHÔNG** chọn Gmail account (`tungchinhus_gmail.com`)
   - ✅ **CHỌN** Microsoft 365 account hoặc Outlook.com account
   - Nếu chưa có, tạo mới: https://outlook.com

3. **Nếu không có Microsoft 365/Outlook.com account:**
   - Tạo Outlook.com account: https://outlook.com
   - Hoặc tạo Microsoft account: https://account.microsoft.com
   - Sau đó đăng nhập lại bằng account mới

### Bước 3: Kiểm tra lại

Sau khi đăng nhập lại, chạy script kiểm tra:

1. Mở Console: **F12** > **Console**
2. Copy và paste:
   ```javascript
   const token = localStorage.getItem('thihi_microsoft_token');
   if (!token) {
     console.error('❌ Chưa đăng nhập');
   } else {
     fetch('https://graph.microsoft.com/v1.0/me', {
       headers: { 'Authorization': `Bearer ${token}` }
     })
     .then(r => r.json())
     .then(data => {
       console.log('👤 User:', data.displayName);
       console.log('📧 Mail:', data.mail || 'NULL');
       console.log('🔑 UPN:', data.userPrincipalName);
       
       if (data.userPrincipalName && data.userPrincipalName.includes('#EXT#')) {
         console.error('❌ Vẫn là external user! Vui lòng đăng nhập bằng Microsoft 365/Outlook.com account.');
       } else if (!data.mail) {
         console.warn('⚠️ Vẫn không có mail address');
       } else {
         console.log('✅ SUCCESS! Có mailbox:', data.mail);
         console.log('✅ Bây giờ có thể hỏi AI về email!');
       }
     });
   }
   ```

3. **Kết quả mong đợi:**
   - ✅ Không còn `#EXT#` trong User Principal Name
   - ✅ Có `mail` address (không phải `null`)
   - ✅ Có thể hỏi AI: "có email mới không?"

## 🧪 Test trong App

Sau khi fix xong:

1. **Hỏi AI:** "có email mới không?"
2. **Hoặc:** "có email nào mới gửi hôm nay không?"
3. **Kết quả mong đợi:**
   - ✅ AI sẽ truy cập email và trả lời về email thực tế
   - ❌ Nếu vẫn lỗi, xem Firebase logs: `firebase functions:log`

## ⚠️ Lưu ý

- **Gmail account:** ❌ Không thể dùng để đọc email qua Graph API
- **Microsoft 365 account:** ✅ Hỗ trợ đầy đủ
- **Outlook.com account:** ✅ Hỗ trợ đầy đủ
- **Personal Microsoft account:** ✅ Hỗ trợ đầy đủ

## 🆘 Vẫn không hoạt động?

Nếu sau khi đăng nhập bằng Microsoft 365/Outlook.com mà vẫn lỗi:

1. **Kiểm tra lại script** ở Bước 3
2. **Xem Firebase logs:** `firebase functions:log`
3. **Kiểm tra account có license không:**
   - Vào Azure Portal: https://portal.azure.com
   - Vào "Microsoft Entra ID" > "Users"
   - Tìm user của bạn
   - Kiểm tra "Licenses" - phải có Microsoft 365 license

---

## 📝 Tóm tắt

1. ✅ **Đã xác định:** External user (Gmail) - không có mailbox
2. 🔧 **Cần làm:** Đăng xuất → Đăng nhập lại bằng Microsoft 365/Outlook.com
3. ✅ **Kết quả:** Có mailbox → AI có thể đọc email

**Bắt đầu từ Bước 1 ngay bây giờ!** 🚀

