# Hướng dẫn Debug SSO Google Login

Nếu popup SSO không mở được, hãy làm theo các bước sau:

## 1. Kiểm tra Firebase Console

### Bước 1: Bật Google Sign-In Provider
1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project của bạn
3. Vào **Authentication** > **Sign-in method**
4. Tìm **Google** trong danh sách providers
5. Click vào **Google** và bật nó
6. Nhập **Project support email** (email hỗ trợ dự án)
7. Click **Save**

### Bước 2: Thêm Authorized Domains
1. Vẫn trong **Authentication** > **Sign-in method**
2. Click vào tab **Settings** (hoặc tìm "Authorized domains")
3. Trong phần **Authorized domains**, thêm:
   - `localhost` (đã có sẵn cho development)
   - Domain production của bạn (ví dụ: `yourdomain.com`)
   - Nếu dùng Firebase Hosting, domain sẽ tự động được thêm

## 2. Kiểm tra Console của trình duyệt

1. Mở ứng dụng
2. Nhấn **F12** để mở Developer Tools
3. Vào tab **Console**
4. Click nút "Đăng nhập"
5. Xem các thông báo lỗi trong Console

### Các lỗi thường gặp:

#### `auth/configuration-not-found` ⚠️ **LỖI PHỔ BIẾN NHẤT**
- **Nguyên nhân**: Google Sign-In provider chưa được bật hoặc Identity Toolkit API chưa được enable
- **Giải pháp**: 

  **BƯỚC 1: Bật Google Sign-In trong Firebase Console**
  1. Vào [Firebase Console](https://console.firebase.google.com/)
  2. Chọn project của bạn (thithi-3e545)
  3. Vào **Authentication** > **Sign-in method**
  4. Tìm **Google** trong danh sách providers
  5. Click vào **Google** và bật nó (Enable)
  6. Nhập **Project support email** (email hỗ trợ dự án)
  7. Click **Save**

  **BƯỚC 2: Bật Identity Toolkit API trong Google Cloud Console** ⚠️ **QUAN TRỌNG**
  1. Vào [Google Cloud Console](https://console.cloud.google.com/)
  2. Chọn project: **thithi-3e545** (hoặc project ID của bạn)
  3. Vào **APIs & Services** > **Library** (hoặc tìm "APIs & Services" trong menu)
  4. Tìm kiếm: **"Identity Toolkit API"**
  5. Click vào **Identity Toolkit API**
  6. Click nút **Enable** (Bật)
  7. Đợi 1-2 phút để API được kích hoạt

  **Sau khi hoàn thành cả 2 bước:**
  - Đợi 1-2 phút để cấu hình được cập nhật
  - Refresh trang ứng dụng (F5)
  - Thử đăng nhập lại

#### `auth/operation-not-allowed`
- **Nguyên nhân**: Google Sign-In chưa được bật trong Firebase Console
- **Giải pháp**: Làm theo Bước 1 ở trên

#### `auth/unauthorized-domain`
- **Nguyên nhân**: Domain chưa được thêm vào Authorized domains
- **Giải pháp**: Làm theo Bước 2 ở trên

#### `auth/popup-blocked`
- **Nguyên nhân**: Trình duyệt đang chặn popup
- **Giải pháp**: 
  1. Cho phép popup cho trang web này
  2. Code sẽ tự động chuyển sang phương thức redirect nếu popup bị chặn

#### `auth/popup-closed-by-user`
- **Nguyên nhân**: Người dùng đóng popup trước khi đăng nhập xong
- **Giải pháp**: Thử lại và không đóng popup

## 3. Kiểm tra cấu hình Firebase

Mở file `src/environments/environment.ts` và kiểm tra:

```typescript
firebaseConfig: {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ...
}
```

Đảm bảo các giá trị này khớp với Firebase Console của bạn.

## 4. Kiểm tra Network

1. Mở Developer Tools (F12)
2. Vào tab **Network**
3. Click nút "Đăng nhập"
4. Tìm các request đến `identitytoolkit.googleapis.com` hoặc `accounts.google.com`
5. Kiểm tra xem có request nào bị lỗi không (status code 4xx hoặc 5xx)

## 5. Thử các trình duyệt khác

- Chrome (khuyến nghị)
- Edge
- Firefox
- Safari

## 6. Xóa cache và cookies

1. Xóa cache của trình duyệt
2. Xóa cookies cho domain của bạn
3. Thử lại

## 7. Kiểm tra Firewall/Antivirus

Một số phần mềm bảo mật có thể chặn popup hoặc kết nối đến Google. Tạm thời tắt và thử lại.

## 8. Kiểm tra code

Nếu vẫn không hoạt động, mở Console và kiểm tra:

1. Có thông báo "Starting Google sign-in..." không?
2. Có thông báo "Attempting sign-in with popup..." không?
3. Lỗi cụ thể là gì?

Gửi các thông báo này để được hỗ trợ thêm.

## Lưu ý quan trọng

- **Development (localhost)**: Popup thường hoạt động tốt
- **Production**: Đảm bảo domain đã được thêm vào Authorized domains
- **HTTPS**: Firebase Auth yêu cầu HTTPS trong production (localhost là ngoại lệ)

## Liên hệ hỗ trợ

Nếu vẫn gặp vấn đề, vui lòng cung cấp:
1. Thông báo lỗi từ Console (F12)
2. Screenshot của Firebase Console (Authentication > Sign-in method)
3. Trình duyệt và phiên bản đang sử dụng

