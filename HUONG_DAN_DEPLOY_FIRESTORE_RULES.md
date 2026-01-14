# Hướng Dẫn Deploy Firestore Rules

## Vấn đề

Khi import Excel, bạn gặp lỗi: **"Missing or insufficient permissions"**

Nguyên nhân: Firestore rules chưa được deploy lên Firebase.

## Giải pháp

### Bước 1: Kiểm tra Firestore Rules

File `firestore.rules` đã được cấu hình đúng:

```javascript
// TSMay collection - Excel import data
// Allow authenticated users to read and write
match /TSMay/{documentId} {
  allow read, write: if request.auth != null;
}
```

### Bước 2: Deploy Firestore Rules

Chạy lệnh sau trong terminal:

```bash
firebase deploy --only firestore:rules
```

Hoặc deploy tất cả (rules + hosting + functions):

```bash
firebase deploy
```

### Bước 3: Xác nhận Deploy thành công

Sau khi deploy, bạn sẽ thấy thông báo:

```
✔  Deploy complete!

Firestore Rules deployed successfully
```

### Bước 4: Kiểm tra trong Firebase Console

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project của bạn
3. Vào **Firestore Database** > **Rules**
4. Kiểm tra xem rules đã được cập nhật chưa

## Lưu ý quan trọng

1. **Authentication bắt buộc**: User phải đăng nhập trước khi import
2. **Rules chỉ áp dụng cho authenticated users**: `request.auth != null`
3. **Sau khi deploy rules, có thể mất 1-2 phút để rules có hiệu lực**

## Troubleshooting

### Nếu vẫn gặp lỗi permissions sau khi deploy:

1. **Kiểm tra user đã đăng nhập chưa:**
   - Xem trong Console: `console.log('User:', user)`
   - Đảm bảo `user` không phải `null`

2. **Kiểm tra Firestore Rules trong Console:**
   - Vào Firebase Console > Firestore > Rules
   - Đảm bảo rules đã được deploy đúng

3. **Clear cache và thử lại:**
   - Hard refresh browser (Ctrl+Shift+R)
   - Đăng xuất và đăng nhập lại

4. **Kiểm tra Firebase project:**
   - Đảm bảo đang dùng đúng project
   - Kiểm tra `firebase.json` và `.firebaserc`

## Test Rules

Sau khi deploy, test bằng cách:

1. Đăng nhập vào app
2. Thử import file Excel nhỏ (1-2 dòng)
3. Kiểm tra trong Firestore Console xem dữ liệu đã được lưu chưa
