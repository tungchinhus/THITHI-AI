# Hướng Dẫn Cấu Hình Telegram Bot với Mini App URL

## Tổng Quan

Sau khi deploy frontend, bạn cần cấu hình Telegram Bot để người dùng có thể mở Mini App từ bot. Mini App URL sẽ trỏ đến ứng dụng web của bạn.

## Yêu Cầu

1. ✅ Telegram Bot đã được tạo (qua @BotFather)
2. ✅ Bot Token đã được set vào Firebase Secrets
3. ✅ Frontend đã được deploy (Firebase Hosting hoặc domain riêng)
4. ✅ Có URL của ứng dụng web

## Các Bước Cấu Hình

### Bước 1: Lấy URL Ứng Dụng

**Nếu dùng Firebase Hosting:**

1. Vào Firebase Console: https://console.firebase.google.com/project/thithi-3e545/hosting
2. Xem URL hosting của bạn
3. URL thường có dạng: `https://thithi-ai.web.app` hoặc `https://thithi-3e545.web.app`

**Nếu dùng domain riêng:**

- URL domain của bạn (ví dụ: `https://yourdomain.com`)

**Lưu ý**: URL phải là HTTPS và có thể truy cập công khai.

### Bước 2: Mở BotFather

1. Mở Telegram
2. Tìm [@BotFather](https://t.me/botfather)
3. Bắt đầu chat với BotFather

### Bước 3: Chọn Bot

**Nếu đã có bot:**

1. Gửi lệnh `/mybots`
2. Chọn bot của bạn từ danh sách

**Nếu chưa có bot:**

1. Gửi lệnh `/newbot`
2. Làm theo hướng dẫn để tạo bot mới
3. Lưu Bot Token (đã set vào Firebase Secrets)

### Bước 4: Tạo Mini App

1. Trong menu bot, chọn **"Bot Settings"** hoặc **"Edit Bot"**
2. Chọn **"Menu Button"** hoặc **"Web App"**
3. Chọn **"Edit"** hoặc **"New Web App"**

### Bước 5: Cấu Hình Mini App

BotFather sẽ hỏi các thông tin:

1. **Title** (Tiêu đề):
   ```
   THITHI AI
   ```
   Hoặc tên app của bạn

2. **Description** (Mô tả):
   ```
   Trợ lý AI thông minh nội bộ
   ```
   Hoặc mô tả ngắn gọn về app

3. **Photo** (Ảnh - Tùy chọn):
   - Có thể bỏ qua hoặc gửi ảnh logo
   - Format: JPG/PNG, tối đa 640x360px

4. **Short Name** (Tên ngắn - Tùy chọn):
   ```
   thithi-ai
   ```
   Hoặc tên ngắn cho app

5. **Web App URL** (URL Mini App - **QUAN TRỌNG**):
   ```
   https://thithi-ai.web.app
   ```
   Thay bằng URL thực tế của bạn

### Bước 6: Xác Nhận

BotFather sẽ hiển thị thông tin Mini App và hỏi xác nhận. Chọn **"Yes"** hoặc **"Confirm"**.

### Bước 7: Kiểm Tra

1. Mở bot của bạn trên Telegram
2. Bạn sẽ thấy nút **"Menu"** hoặc **"Web App"** ở dưới khung chat
3. Click vào nút để mở Mini App
4. Mini App sẽ mở trong Telegram

## Cách Thay Đổi Mini App URL (Nếu Cần)

Nếu cần thay đổi URL sau khi đã cấu hình:

1. Mở @BotFather
2. Gửi `/mybots`
3. Chọn bot của bạn
4. Chọn **"Bot Settings"** → **"Menu Button"** → **"Edit"**
5. Chọn **"Web App URL"**
6. Nhập URL mới
7. Xác nhận

## Cấu Hình Menu Button (Tùy Chọn)

Bạn có thể tùy chỉnh menu button:

1. Trong @BotFather, chọn bot → **"Bot Settings"** → **"Menu Button"**
2. Chọn **"Edit Menu Button"**
3. Có thể:
   - Thay đổi text của button
   - Thay đổi URL
   - Ẩn/hiện button

## Kiểm Tra Mini App Hoạt Động

### Test 1: Mở Mini App từ Bot

1. Mở bot trên Telegram
2. Click nút **"Menu"** hoặc **"Web App"**
3. Mini App sẽ mở trong Telegram
4. Kiểm tra xem app có load được không

### Test 2: Kiểm Tra Authentication

1. Mở Mini App
2. Kiểm tra console (F12) để xem:
   - Telegram WebApp API có sẵn không
   - `initData` có được lấy không
   - Authentication có hoạt động không

### Test 3: Test với Nhân Viên

1. Đảm bảo nhân viên đã có trong Firestore collection `employees`
2. Nhân viên mở Mini App
3. Kiểm tra xem có tự động đăng nhập không

## Troubleshooting

### Lỗi: "Mini App không mở được"

**Nguyên nhân có thể:**
- URL không đúng
- URL không phải HTTPS
- URL không thể truy cập công khai
- App chưa được deploy

**Giải pháp:**
1. Kiểm tra URL trong BotFather
2. Thử mở URL trực tiếp trên trình duyệt
3. Đảm bảo URL là HTTPS
4. Kiểm tra Firebase Hosting đã deploy chưa

### Lỗi: "App không load"

**Nguyên nhân có thể:**
- CORS issues
- App có lỗi JavaScript
- Network issues

**Giải pháp:**
1. Mở Developer Tools (F12) trong Mini App
2. Kiểm tra Console để xem lỗi
3. Kiểm tra Network tab để xem requests
4. Kiểm tra Firebase Hosting logs

### Lỗi: "Authentication không hoạt động"

**Nguyên nhân có thể:**
- `initData` không có
- Functions chưa được deploy
- Secret chưa được set

**Giải pháp:**
1. Kiểm tra `window.Telegram.WebApp.initData` có giá trị không
2. Kiểm tra functions đã deploy: `firebase functions:list`
3. Kiểm tra secret: `firebase functions:secrets:access TELEGRAM_BOT_TOKEN`
4. Kiểm tra logs: `firebase functions:log --only telegramLogin`

### Lỗi: "Bot không hiển thị Menu Button"

**Nguyên nhân có thể:**
- Chưa cấu hình Menu Button
- Bot version cũ

**Giải pháp:**
1. Vào @BotFather → Bot Settings → Menu Button
2. Đảm bảo đã set Web App URL
3. Update Telegram app lên phiên bản mới nhất

## Ví Dụ Cấu Hình

### Ví Dụ 1: Cấu Hình Cơ Bản

```
Bot: @mycompany_bot
Title: THITHI AI
Description: Trợ lý AI thông minh
URL: https://thithi-ai.web.app
```

### Ví Dụ 2: Cấu Hình với Domain Riêng

```
Bot: @mycompany_bot
Title: THITHI AI
Description: Trợ lý AI thông minh
URL: https://app.mycompany.com
```

## Lưu Ý Quan Trọng

1. **URL phải là HTTPS**: Telegram chỉ hỗ trợ HTTPS
2. **URL phải công khai**: Không thể dùng localhost hoặc IP nội bộ
3. **CORS**: Đảm bảo app cho phép requests từ Telegram domain
4. **Mobile-friendly**: Mini App sẽ mở trên mobile, đảm bảo responsive

## Cấu Hình Nâng Cao

### Thêm Bot Commands

Bạn có thể thêm commands cho bot:

1. Trong @BotFather, chọn bot → **"Bot Settings"** → **"Commands"**
2. Thêm commands:
   ```
   start - Bắt đầu sử dụng
   help - Trợ giúp
   app - Mở Mini App
   ```

### Thêm Bot Description

1. Trong @BotFather, chọn bot → **"Bot Settings"** → **"Description"**
2. Thêm mô tả về bot và Mini App

### Thêm Bot About Text

1. Trong @BotFather, chọn bot → **"Bot Settings"** → **"About"**
2. Thêm thông tin về bot

## Checklist

- [ ] Bot đã được tạo
- [ ] Bot Token đã được set vào Firebase Secrets
- [ ] Frontend đã được deploy
- [ ] Có URL của ứng dụng (HTTPS)
- [ ] Đã cấu hình Mini App trong @BotFather
- [ ] Menu Button hiển thị trong bot
- [ ] Mini App mở được từ bot
- [ ] Authentication hoạt động
- [ ] Test với nhân viên thực tế

## Next Steps

Sau khi cấu hình xong:

1. ✅ Test Mini App từ bot
2. ✅ Test authentication flow
3. ✅ Test với nhân viên thực tế
4. ✅ Hướng dẫn nhân viên sử dụng

Xem thêm:
- `HUONG_DAN_TELEGRAM_AUTH.md` - Hướng dẫn đầy đủ
- `HUONG_DAN_TAO_EMPLOYEES_COLLECTION.md` - Tạo collection employees
