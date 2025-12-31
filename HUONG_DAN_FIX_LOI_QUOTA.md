# Hướng dẫn khắc phục lỗi "Đã vượt quá quota của Gemini API"

## 🔍 Nguyên nhân

Lỗi quota có thể xảy ra do:
1. **API key đã hết quota** (đã sử dụng hết số lần gọi API miễn phí)
2. **API key không hợp lệ** hoặc đã bị thu hồi
3. **Chưa enable Generative Language API** trong Google Cloud Console
4. **API key không có quyền** truy cập Gemini API

## ✅ Cách khắc phục

### Bước 1: Kiểm tra API key hiện tại

```bash
firebase functions:secrets:access GEMINI_API_KEY
```

Kiểm tra xem API key có đúng không.

### Bước 2: Tạo API key mới

1. **Truy cập:** https://makersuite.google.com/app/apikey
2. **Đăng nhập** bằng tài khoản Google của bạn
3. **Click "Create API Key"** hoặc **"Get API Key"**
4. **Chọn project** (hoặc tạo project mới)
5. **Copy API key** mới

### Bước 3: Set API key mới vào Firebase

```bash
echo YOUR_NEW_API_KEY | firebase functions:secrets:set GEMINI_API_KEY
```

Thay `YOUR_NEW_API_KEY` bằng API key mới của bạn.

### Bước 4: Enable Generative Language API

1. **Truy cập:** https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. **Chọn project** của bạn (project chứa API key)
3. **Click "Enable"** nếu chưa enable

### Bước 5: Deploy lại Function

```bash
firebase deploy --only functions:chatFunction
```

### Bước 6: Kiểm tra Quota (nếu vẫn lỗi)

1. **Truy cập:** https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. **Chọn project** của bạn
3. **Xem quota hiện tại:**
   - Requests per minute
   - Requests per day
   - Tokens per minute
4. **Kiểm tra thời gian reset** quota

## 🎯 Giải pháp nhanh nhất

**Tạo API key mới** thường là cách nhanh nhất để có quota mới:

```bash
# 1. Lấy API key mới từ https://makersuite.google.com/app/apikey
# 2. Set vào Firebase
echo AIzaSy...YOUR_NEW_KEY | firebase functions:secrets:set GEMINI_API_KEY

# 3. Deploy lại
firebase deploy --only functions:chatFunction
```

## 📊 Kiểm tra logs để debug

Nếu vẫn lỗi, kiểm tra logs chi tiết:

```bash
firebase functions:log --only chatFunction
```

## 💡 Lưu ý

- **Model miễn phí:** Function tự động chọn `gemini-1.5-flash` (model miễn phí với quota cao)
- **Quota reset:** Quota thường reset theo ngày/tháng, tùy theo loại quota
- **Nhiều API key:** Bạn có thể tạo nhiều API key để tăng quota tổng
- **Billing:** Một số model yêu cầu billing enabled, nhưng `gemini-1.5-flash` là miễn phí

## 🔗 Links hữu ích

- **Tạo API key:** https://makersuite.google.com/app/apikey
- **Google Cloud Console:** https://console.cloud.google.com
- **Enable API:** https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
- **Kiểm tra quota:** https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

