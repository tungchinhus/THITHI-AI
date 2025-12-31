# 🔍 Hướng dẫn kiểm tra nguyên nhân lỗi "Đã vượt quá quota của Gemini API"

## Các bước kiểm tra

### Bước 1: Kiểm tra API key hiện tại

```bash
# Kiểm tra API key trong Firebase secrets
firebase functions:secrets:access GEMINI_API_KEY

# Hoặc dùng npx nếu chưa cài global
npx firebase-tools functions:secrets:access GEMINI_API_KEY
```

**Nếu lỗi "Permission denied":**
- Secret Manager API chưa được enable
- Xem hướng dẫn chi tiết: `HUONG_DAN_ENABLE_SECRET_MANAGER.md`
- Hoặc truy cập: https://console.cloud.google.com/apis/library/secretmanager.googleapis.com
- Click "Enable" để bật API
- Hoặc lấy API key trực tiếp từ: https://makersuite.google.com/app/apikey

**Nếu lỗi "firebase is not recognized":**
- Cài đặt: `npm install -g firebase-tools`
- Hoặc dùng: `npx firebase-tools` thay vì `firebase`
- Login: `npx firebase-tools login`

### Bước 2: Chạy script kiểm tra

```bash
# Cách 1: Tự động lấy từ Firebase secrets
node check-error.js

# Cách 2: Truyền API key trực tiếp
node check-error.js YOUR_API_KEY
```

Script sẽ kiểm tra:
- ✅ **ListModels API**: Kiểm tra API key có hợp lệ và có quyền truy cập không
- ✅ **GenerateContent API**: Kiểm tra có thể gọi API với model miễn phí không
- ✅ **Quota**: Phát hiện lỗi quota và đưa ra giải pháp cụ thể

### Bước 3: Kiểm tra logs của Firebase Function

```bash
# Xem logs gần đây
firebase functions:log --only chatFunction

# Xem logs với filter
firebase functions:log --only chatFunction | grep -i "quota\|error\|429"
```

**Tìm kiếm trong logs:**
- `429` - Lỗi quota exceeded
- `RESOURCE_EXHAUSTED` - Đã hết quota
- `limit: 0` - API key không có free tier quota
- `401` - API key không hợp lệ
- `403` - Không có quyền truy cập

### Bước 4: Kiểm tra quota trong Google Cloud Console

1. **Truy cập:** https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. **Chọn project** của bạn (project chứa API key)
3. **Xem các metrics:**
   - Requests per minute
   - Requests per day
   - Tokens per minute
   - Tokens per day
4. **Kiểm tra thời gian reset** quota

### Bước 5: Kiểm tra model đang được sử dụng

Trong logs của Function, tìm dòng:
```
✅ Selected model: gemini-1.5-flash
```

**Các model miễn phí (có quota cao):**
- `gemini-1.5-flash` ✅ (khuyến nghị)
- `gemini-1.5-pro` ✅

**Các model có thể yêu cầu billing:**
- `gemini-2.0-flash` ⚠️
- `gemini-2.5-flash` ⚠️
- `gemini-2.5-pro` ⚠️

## 🔍 Phân tích các loại lỗi

### 1. Lỗi "limit: 0" (API key không có free tier)

**Nguyên nhân:**
- API key được tạo từ project không có free tier
- Model yêu cầu billing enabled
- API key đã bị thu hồi quyền

**Giải pháp:**
```bash
# 1. Tạo API key mới từ project có free tier
# Truy cập: https://makersuite.google.com/app/apikey

# 2. Set API key mới
echo YOUR_NEW_API_KEY | firebase functions:secrets:set GEMINI_API_KEY

# 3. Deploy lại Function
firebase deploy --only functions:chatFunction
```

### 2. Lỗi "quota exceeded" (Đã hết quota)

**Nguyên nhân:**
- Đã sử dụng hết quota miễn phí trong ngày/tháng
- Quá nhiều requests trong thời gian ngắn

**Giải pháp:**
1. **Đợi reset quota** (thường reset theo ngày/tháng)
2. **Kiểm tra thời gian reset** trong Console
3. **Tạo API key mới** để có quota mới
4. **Sử dụng model miễn phí** (Function tự động chọn `gemini-1.5-flash`)

### 3. Lỗi 401 (API key không hợp lệ)

**Nguyên nhân:**
- API key bị sai hoặc đã bị xóa
- API key không đúng project

**Giải pháp:**
```bash
# 1. Kiểm tra API key
firebase functions:secrets:access GEMINI_API_KEY

# 2. Tạo API key mới
# https://makersuite.google.com/app/apikey

# 3. Set lại
echo YOUR_NEW_API_KEY | firebase functions:secrets:set GEMINI_API_KEY

# 4. Deploy lại
firebase deploy --only functions:chatFunction
```

### 4. Lỗi 403 (Không có quyền)

**Nguyên nhân:**
- Chưa enable Generative Language API
- API key không có quyền truy cập

**Giải pháp:**
1. **Enable API:**
   - Truy cập: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
   - Click "Enable"
2. **Kiểm tra API key có đúng project không**
3. **Tạo API key mới** với đầy đủ quyền

## 🎯 Giải pháp nhanh nhất

**Nếu gặp lỗi quota, thử các bước sau theo thứ tự:**

1. **Kiểm tra logs để xác định loại lỗi:**
   ```bash
   firebase functions:log --only chatFunction | tail -50
   ```

2. **Nếu là "limit: 0":**
   - Tạo API key mới từ project có free tier
   - Set và deploy lại

3. **Nếu là "quota exceeded":**
   - Đợi reset quota
   - Hoặc tạo API key mới

4. **Kiểm tra Function có dùng model miễn phí không:**
   - Function tự động chọn `gemini-1.5-flash` (model miễn phí)
   - Nếu logs hiển thị model khác, có thể model đó không có free tier

## 📊 Kiểm tra trực tiếp trong code

Mở file `functions/index.js` và kiểm tra:

1. **Dòng 17:** `FORCE_FREE_MODEL = true` - Đảm bảo đang force dùng model miễn phí
2. **Dòng 102-114:** Danh sách model ưu tiên - `gemini-1.5-flash` nên ở đầu tiên
3. **Dòng 368-394:** Logic xử lý lỗi quota

## 🔗 Links hữu ích

- **Tạo API key:** https://makersuite.google.com/app/apikey
- **Google Cloud Console:** https://console.cloud.google.com
- **Enable API:** https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
- **Kiểm tra quota:** https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
- **Firebase Console:** https://console.firebase.google.com

## 💡 Lưu ý

- **Model miễn phí:** Function tự động chọn `gemini-1.5-flash` (model miễn phí với quota cao nhất)
- **Quota reset:** Quota thường reset theo ngày/tháng, tùy theo loại quota
- **Nhiều API key:** Bạn có thể tạo nhiều API key để tăng quota tổng
- **Billing:** Model `gemini-1.5-flash` và `gemini-1.5-pro` không yêu cầu billing

