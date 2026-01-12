# Hướng Dẫn Xác Thực Telegram Mini App

Hướng dẫn này giải thích cách thiết lập và sử dụng hệ thống xác thực bảo mật cho Telegram Mini App sử dụng Firebase.

## Tổng Quan

Hệ thống triển khai **xác thực dựa trên whitelist** cho nhân viên nội bộ (khoảng 30 người) sử dụng:

- **Firebase Cloud Functions** (Node.js) - Xác thực backend
- **Firestore Database** - Lưu trữ danh sách nhân viên
- **Firebase Authentication** - Xác thực bằng custom token
- **Telegram Mini App** - Giao diện frontend

## Kiến Trúc

### Luồng 1: Onboarding (Telegram Bot)
1. Người dùng chat với Telegram Bot
2. Người dùng chia sẻ Contact (Số điện thoại) qua nút
3. Bot gọi endpoint `telegramOnboarding`
4. Hệ thống xác minh số điện thoại với collection `employees`
5. Liên kết `telegramId` với bản ghi nhân viên

### Luồng 2: Đăng Nhập (Mini App)
1. Người dùng mở Mini App
2. Frontend gửi `initData` đến endpoint `telegramLogin`
3. Backend xác minh chữ ký Telegram & whitelist
4. Trả về Firebase Custom Token
5. Frontend đăng nhập bằng custom token

## Yêu Cầu

1. **Firebase Project** với:
   - Cloud Functions đã bật
   - Firestore Database đã bật
   - Authentication đã bật
   - Secret Manager đã bật (cho bot token)

2. **Telegram Bot** được tạo qua [@BotFather](https://t.me/botfather)
   - Lấy Bot Token
   - Tạo Mini App (đặt URL web app)

3. **Firestore Collection**: `employees`
   - Documents với schema:
     ```json
     {
       "phoneNumber": "0901234567",  // đã chuẩn hóa, không có +84
       "fullName": "Nguyen Van A",
       "role": "driver",  // hoặc "admin"
       "telegramId": "123456789",  // string, ban đầu là null
       "isLinked": false,
       "isActive": true
     }
     ```

## Các Bước Thiết Lập

### Bước 1: Cấu Hình Firebase Secrets

Đặt Telegram Bot Token làm secret:

**Cách 1: Set và nhập token khi được hỏi (Khuyến nghị)**

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

Sau đó dán token từ BotFather khi được hỏi.

**Cách 2: Set trực tiếp từ command line**

**Windows (PowerShell):**
```powershell
echo "YOUR_BOT_TOKEN" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

**Linux/Mac:**
```bash
echo "YOUR_BOT_TOKEN" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

**Quan trọng**: 
- Thay `YOUR_BOT_TOKEN` bằng bot token thực tế từ BotFather
- Token có dạng: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890`
- Không cần `cd functions`, có thể chạy từ thư mục gốc

**Kiểm tra secret đã được set:**

```bash
firebase functions:secrets:access TELEGRAM_BOT_TOKEN
```

Nếu hiển thị token, nghĩa là đã set thành công.

**Lưu ý**: 
- Nếu chưa bật Secret Manager, xem file `HUONG_DAN_ENABLE_SECRET_MANAGER.md`
- Xem hướng dẫn chi tiết: `HUONG_DAN_SET_TELEGRAM_BOT_TOKEN.md`

### Bước 2: Deploy Cloud Functions

**Cách 1: Deploy chỉ Telegram Auth Functions**

```bash
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

**Cách 2: Deploy tất cả Functions (Khuyến nghị)**

```bash
firebase deploy --only functions
```

**Lưu ý**: 
- Không cần `cd functions`, có thể chạy từ thư mục gốc
- Nếu dùng `npx`: `npx firebase-tools deploy --only functions`
- Sau khi deploy, lưu lại Function URLs để cấu hình Telegram Bot

**Kiểm tra deploy thành công:**

Sau khi deploy, bạn sẽ thấy Function URLs:
```
Function URL (telegramOnboarding): https://us-central1-thithi-3e545.cloudfunctions.net/telegramOnboarding
Function URL (telegramLogin): https://us-central1-thithi-3e545.cloudfunctions.net/telegramLogin
```

**Xem logs nếu có lỗi:**

```bash
firebase functions:log --only telegramOnboarding,telegramLogin
```

### Bước 3: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Bước 4: Tạo Collection Employees

1. Vào Firebase Console → Firestore Database
2. Tạo collection: `employees`
3. Thêm documents cho mỗi nhân viên:

   **Ví dụ Document:**
   - Document ID: `emp_001` (hoặc tự động)
   - Fields:
     - `phoneNumber` (string): `"0901234567"`
     - `fullName` (string): `"Nguyen Van A"`
     - `role` (string): `"driver"` hoặc `"admin"`
     - `telegramId` (string): `null` (sẽ được set khi onboarding)
     - `isLinked` (boolean): `false`
     - `isActive` (boolean): `true`

**Ví dụ thêm nhiều nhân viên:**

```json
// Document 1: emp_001
{
  "phoneNumber": "0901234567",
  "fullName": "Nguyen Van A",
  "role": "driver",
  "telegramId": null,
  "isLinked": false,
  "isActive": true
}

// Document 2: emp_002
{
  "phoneNumber": "0912345678",
  "fullName": "Tran Thi B",
  "role": "admin",
  "telegramId": null,
  "isLinked": false,
  "isActive": true
}
```

### Bước 5: Cấu Hình Telegram Bot

**Cách 1: Qua @BotFather (Khuyến nghị)**

1. Mở [@BotFather](https://t.me/botfather) trên Telegram
2. Gửi `/mybots` (nếu đã có bot) hoặc `/newbot` (nếu chưa có)
3. Chọn bot của bạn
4. Chọn **"Bot Settings"** → **"Menu Button"** → **"Edit"**
5. Đặt các thông tin:
   - **Title**: Tên app (ví dụ: "THITHI AI")
   - **Description**: Mô tả ngắn
   - **Web App URL**: URL app đã deploy (ví dụ: `https://thithi-ai.web.app`)
6. Xác nhận và lưu

**Cách lấy URL sau khi deploy:**
- Nếu dùng Firebase Hosting: 
  - Vào Firebase Console → Hosting
  - URL thường là: `https://your-project-id.web.app` hoặc `https://your-site-name.web.app`
- Nếu dùng domain riêng: URL domain của bạn

**Kiểm tra:**
- Mở bot trên Telegram
- Bạn sẽ thấy nút **"Menu"** hoặc **"Web App"** ở dưới khung chat
- Click vào để mở Mini App

**Xem hướng dẫn chi tiết**: `HUONG_DAN_CAU_HINH_TELEGRAM_BOT.md`

### Bước 6: Cập Nhật Frontend Environment

Cập nhật `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  firebaseConfig: {
    // ... config hiện tại
  },
  firebaseFunctionUrl: "https://your-function-url.cloudfunctions.net",
  // URL Telegram functions sẽ được tự động tính từ firebaseFunctionUrl
};
```

**Lưu ý**: URL function thường có dạng:
- `https://REGION-PROJECT_ID.cloudfunctions.net/functionName`
- Hoặc `https://function-name-xxx-uc.a.run.app` (nếu dùng v2)

### Bước 7: Build và Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

## Cách Sử Dụng

### Cho Người Dùng Cuối (Telegram Mini App)

1. **Lần Đầu (Onboarding)**:
   - Mở Telegram Bot
   - Click nút để chia sẻ contact
   - Bot xác minh số điện thoại
   - Tài khoản được liên kết

2. **Sử Dụng Mini App**:
   - Mở Mini App từ bot
   - Xác thực tự động diễn ra
   - Người dùng đã đăng nhập vào Firebase
   - Có thể sử dụng tất cả tính năng app

### Cho Quản Trị Viên

#### Thêm Nhân Viên Mới

1. Vào Firebase Console → Firestore
2. Thêm document mới vào collection `employees`:
   ```json
   {
     "phoneNumber": "0901234567",
     "fullName": "Nhân Viên Mới",
     "role": "employee",
     "telegramId": null,
     "isLinked": false,
     "isActive": true
   }
   ```

#### Liên Kết Nhân Viên Thủ Công (Tùy chọn)

Bạn cũng có thể liên kết nhân viên thủ công bằng cách cập nhật document:
- Đặt `telegramId`: `"123456789"`
- Đặt `isLinked`: `true`
- Đặt `linkedAt`: Timestamp hiện tại

#### Vô Hiệu Hóa Nhân Viên

Đặt `isActive`: `false` trong document nhân viên.

## API Endpoints

### 1. Onboarding Endpoint

**URL**: `https://your-function-url/telegramOnboarding`

**Method**: `POST`

**Request Body**:
```json
{
  "phoneNumber": "0901234567",
  "telegramId": "123456789"
}
```

**Response** (Thành công):
```json
{
  "success": true,
  "message": "Phone number linked successfully",
  "employee": {
    "id": "emp_001",
    "phoneNumber": "0901234567",
    "fullName": "Nguyen Van A",
    "role": "driver",
    "telegramId": "123456789",
    "isLinked": true
  }
}
```

**Response** (Lỗi):
```json
{
  "error": "Not Found",
  "message": "Employee not found with this phone number or not active"
}
```

### 2. Login Endpoint

**URL**: `https://your-function-url/telegramLogin`

**Method**: `POST`

**Request Body**:
```json
{
  "initData": "query_id=...&user=...&auth_date=...&hash=..."
}
```

**Response** (Thành công):
```json
{
  "success": true,
  "customToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employee": {
    "id": "emp_001",
    "phoneNumber": "0901234567",
    "fullName": "Nguyen Van A",
    "role": "driver",
    "telegramId": "123456789"
  }
}
```

**Response** (Lỗi):
```json
{
  "error": "Forbidden",
  "message": "Telegram account not linked to any employee or employee not active"
}
```

## Tính Năng Bảo Mật

1. **Xác Minh Chữ Ký Telegram**: Tất cả `initData` được xác minh bằng HMAC-SHA-256
2. **Whitelisting**: Chỉ nhân viên trong Firestore mới có thể truy cập
3. **Chuẩn Hóa Số Điện Thoại**: Định dạng nhất quán (không có +84, khoảng trắng)
4. **Custom Claims**: ID nhân viên và role được lưu trong Firebase token
5. **Firestore Rules**: Chỉ đọc cho collection employees

## Xử Lý Sự Cố

### Lỗi: "TELEGRAM_BOT_TOKEN secret not configured"

**Giải pháp**: Đặt secret:
```bash
echo "YOUR_BOT_TOKEN" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase deploy --only functions
```

**Kiểm tra secret đã được set:**
```bash
firebase functions:secrets:access TELEGRAM_BOT_TOKEN
```

### Lỗi: "Employee not found with this phone number"

**Giải pháp**: 
1. Kiểm tra định dạng số điện thoại trong Firestore (phải chuẩn hóa: `0901234567`)
2. Đảm bảo `isActive` là `true`
3. Xác minh số điện thoại khớp chính xác (phân biệt chữ hoa/thường)

**Lưu ý về định dạng số điện thoại:**
- ✅ Đúng: `0901234567`, `0912345678`
- ❌ Sai: `+84901234567`, `84 901 234 567`, `090-123-4567`

### Lỗi: "Telegram account not linked"

**Giải pháp**:
1. Hoàn thành onboarding trước (chia sẻ contact với bot)
2. Kiểm tra `isLinked` là `true` trong Firestore
3. Xác minh `telegramId` khớp với Telegram user ID

**Kiểm tra trong Firestore:**
- Document nhân viên phải có:
  - `telegramId`: `"123456789"` (không phải null)
  - `isLinked`: `true`
  - `isActive`: `true`

### Lỗi: "Invalid Telegram initData"

**Giải pháp**:
1. Đảm bảo Mini App được mở từ Telegram (không phải trình duyệt trực tiếp)
2. Kiểm tra bot token đúng
3. Xác minh `initData` chưa hết hạn (tối đa 24 giờ)

**Kiểm tra:**
- Mở Mini App từ Telegram Bot (không mở trực tiếp URL)
- `initData` được Telegram tự động cung cấp
- Không cần tạo `initData` thủ công

### Lỗi: "Firebase Auth is not initialized"

**Giải pháp**:
1. Kiểm tra `firebaseConfig` trong `environment.ts`
2. Đảm bảo Firebase project đã bật Authentication
3. Kiểm tra console browser để xem lỗi chi tiết

## Kiểm Thử

### Test Onboarding (qua Bot)

1. Tạo nhân viên test trong Firestore
2. Sử dụng Telegram Bot để chia sẻ contact
3. Bot sẽ gọi onboarding endpoint
4. Kiểm tra Firestore: `isLinked` phải là `true`

**Cách test thủ công:**
```bash
curl -X POST https://your-function-url/telegramOnboarding \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0901234567",
    "telegramId": "123456789"
  }'
```

### Test Login (qua Mini App)

1. Đảm bảo nhân viên đã được liên kết (`isLinked: true`)
2. Mở Mini App từ Telegram
3. Kiểm tra browser console để xem logs xác thực
4. Xác minh Firebase user đã được tạo/xác thực

**Kiểm tra trong browser console:**
- Tìm log: `✅ Telegram authentication successful`
- Kiểm tra `user` object không phải null
- Kiểm tra `isTelegramAuthenticated` là `true`

## Lưu Ý Quan Trọng

- Số điện thoại được chuẩn hóa: `+84901234567` → `0901234567`
- Telegram user IDs được lưu dưới dạng string
- Firebase UIDs có định dạng: `telegram_{telegramId}`
- Custom claims bao gồm: `telegramId`, `employeeId`, `role`
- `initData` hết hạn sau 24 giờ (được xử lý tự động)

## Ví Dụ Sử Dụng

### Ví Dụ 1: Thêm Nhân Viên Mới

1. Vào Firebase Console → Firestore
2. Click "Add document" trong collection `employees`
3. Đặt Document ID: `emp_003` (hoặc để tự động)
4. Thêm fields:
   ```
   phoneNumber: "0923456789"
   fullName: "Le Van C"
   role: "driver"
   telegramId: null
   isLinked: false
   isActive: true
   ```
5. Save

### Ví Dụ 2: Liên Kết Nhân Viên Qua Bot

1. Nhân viên mở Telegram Bot
2. Bot hiển thị nút "Chia sẻ số điện thoại"
3. Nhân viên click và chọn contact
4. Bot nhận số điện thoại và gọi `telegramOnboarding`
5. Hệ thống tìm nhân viên trong Firestore
6. Cập nhật `telegramId` và `isLinked: true`
7. Bot thông báo thành công

### Ví Dỗ 3: Đăng Nhập Mini App

1. Nhân viên mở Mini App từ Telegram Bot
2. Frontend tự động lấy `initData` từ Telegram WebApp
3. Gửi `initData` đến `telegramLogin` endpoint
4. Backend xác minh chữ ký và tìm nhân viên
5. Tạo/trả về Firebase Custom Token
6. Frontend đăng nhập với custom token
7. Người dùng đã được xác thực

## Hỗ Trợ

Nếu gặp vấn đề:

1. **Kiểm tra Firebase Functions logs**:
   ```bash
   firebase functions:log --only telegramOnboarding,telegramLogin
   ```

2. **Kiểm tra browser console** để xem lỗi frontend

3. **Xác minh Firestore rules đã được deploy**:
   ```bash
   firebase firestore:rules:get
   ```

4. **Đảm bảo tất cả secrets đã được set đúng**:
   ```bash
   firebase functions:secrets:access TELEGRAM_BOT_TOKEN
   ```

5. **Kiểm tra Firestore data**:
   - Collection `employees` tồn tại
   - Documents có đầy đủ fields
   - `isActive: true` cho nhân viên cần truy cập

## Tài Liệu Tham Khảo

- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
