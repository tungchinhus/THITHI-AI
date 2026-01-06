# 🧪 Test Function trong Firebase Shell

## 📋 Cách test function trong shell

Bạn đang ở trong Firebase Functions shell (`firebase >`). Có thể test function như sau:

### Bước 1: Lấy token từ browser

1. Mở browser và vào app: `http://localhost:4200`
2. Mở Developer Console (F12)
3. Chạy lệnh trong Console:
   ```javascript
   localStorage.getItem('thihi_microsoft_token')
   ```
4. Copy token (chuỗi dài bắt đầu bằng `eyJ...`)

### Bước 2: Test trong Firebase shell

Trong Firebase shell, paste và chạy (thay `YOUR_TOKEN` bằng token đã copy):

### Test 1: Test với câu hỏi về email và token

```javascript
// Paste vào Firebase shell (thay YOUR_TOKEN bằng token thực tế)
chatFunction({
  method: 'POST',
  body: {
    question: "trong hợp mail tôi co mail nào mới không?",
    microsoftAccessToken: "YOUR_TOKEN_HERE"
  }
}, {
  status: (code) => ({
    json: (data) => {
      console.log('\n=== RESPONSE ===');
      console.log('Status:', code);
      console.log('Answer length:', data.answer?.length || 0);
      console.log('Answer preview:', data.answer?.substring(0, 300));
      console.log('Sources:', data.sources);
      return { status: code, json: data };
    }
  })
});
```

**Lưu ý:** 
- Thay `YOUR_TOKEN_HERE` bằng token từ browser
- Logs sẽ hiển thị trong shell với prefix: `📥`, `📧`, `🔍`, `📡`

### Test 2: Test không có token (để xem AI trả lời gì)

```javascript
chatFunction({
  method: 'POST',
  body: {
    question: "trong hợp mail tôi co mail nào mới không?"
  }
}, {
  status: (code) => ({
    json: (data) => {
      console.log('\n=== RESPONSE (No Token) ===');
      console.log('Answer:', data.answer?.substring(0, 300));
      return { status: code, json: data };
    }
  })
});
```

### Test 3: Test câu hỏi không liên quan email

```javascript
chatFunction({
  method: 'POST',
  body: {
    question: "hôm nay là ngày mấy?"
  }
}, {
  status: (code) => ({
    json: (data) => {
      console.log('\n=== RESPONSE (Non-email question) ===');
      console.log('Answer:', data.answer?.substring(0, 300));
      return { status: code, json: data };
    }
  })
});
```

## 📊 Xem logs trong shell

Khi chạy test, logs sẽ hiển thị trực tiếp trong shell với prefix:
- `📥 Backend received request` - Xác nhận backend nhận được request
- `📧 Email question check` - Check xem có phải câu hỏi về email không
- `🔍 isEmailRelatedQuestion` - Chi tiết keywords được match
- `📧 Calling searchOutlookEmails` - Bắt đầu gọi Graph API
- `📡 Graph API response` - Kết quả từ Graph API
- `✅ Email context added to prompt` - Email context được thêm vào prompt
- `❌ Error searching emails` - Nếu có lỗi

## 🔍 Debug steps

1. **Test với token:**
   - Chạy Test 1 với token thực tế
   - Xem logs để kiểm tra:
     - Token có được nhận không?
     - Câu hỏi có được nhận diện là email question không?
     - Graph API có được gọi không?
     - Có lỗi gì không?

2. **Nếu không có email context:**
   - Kiểm tra log `📡 Graph API response`
   - Xem `emailsCount` có > 0 không
   - Nếu = 0, có thể không có email hoặc filter quá strict

3. **Nếu có lỗi:**
   - Xem log `❌ Error searching emails`
   - Kiểm tra token có hợp lệ không
   - Kiểm tra permissions trong Azure AD

## ⚠️ Lưu ý

- Token có thể hết hạn (thường sau 1 giờ)
- Nếu token hết hạn, cần đăng nhập lại Microsoft trong browser
- Test trong shell sẽ gọi production Graph API (không phải emulator)
- Logs hiển thị trực tiếp trong shell, không cần xem file

