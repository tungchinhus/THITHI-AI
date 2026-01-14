# Fix Lỗi 403 khi Deploy Firestore Rules

## Lỗi
```
Error: Request to https://firebaserules.googleapis.com/v1/projects/thithi-3e545:test had HTTP Error: 403, The caller does not have permission
```

## Nguyên nhân
- Chưa đăng nhập Firebase CLI
- Không có quyền trong Firebase project
- Firestore Rules API chưa được enable

## Giải pháp

### Bước 1: Đăng nhập Firebase CLI

```bash
firebase login
```

Hoặc nếu đã đăng nhập nhưng cần đăng nhập lại:

```bash
firebase logout
firebase login
```

### Bước 2: Kiểm tra project hiện tại

```bash
firebase projects:list
firebase use thithi-3e545
```

### Bước 3: Enable Firestore Rules API

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project: **thithi-3e545**
3. Vào **APIs & Services** > **Library**
4. Tìm **Firebase Rules API**
5. Click **Enable**

Hoặc dùng gcloud CLI:

```bash
gcloud services enable firebaserules.googleapis.com --project=thithi-3e545
```

### Bước 4: Kiểm tra quyền trong Firebase Console

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project: **thithi-3e545**
3. Vào **Project Settings** (⚙️) > **Users and permissions**
4. Đảm bảo account của bạn có quyền **Owner** hoặc **Editor**

### Bước 5: Deploy lại Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## Giải pháp thay thế: Deploy qua Firebase Console

Nếu vẫn gặp lỗi, có thể deploy trực tiếp qua Firebase Console:

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project: **thithi-3e545**
3. Vào **Firestore Database** > **Rules**
4. Copy nội dung từ file `firestore.rules`
5. Paste vào editor trong Console
6. Click **Publish**

## Nội dung Firestore Rules cần deploy

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Employees collection - only readable by authenticated users
    // Write access only through Cloud Functions (server-side)
    match /employees/{employeeId} {
      // Allow read if user is authenticated
      allow read: if request.auth != null;
      
      // Write operations only through Cloud Functions (server-side)
      // No direct client writes allowed
      allow write: if false;
    }
    
    // Users collection (optional, for user profiles)
    match /users/{userId} {
      // Users can only read/write their own document
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // TSMay collection - Excel import data
    // Allow authenticated users to read and write
    match /TSMay/{documentId} {
      allow read, write: if request.auth != null;
    }
    
    // Default: deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Kiểm tra sau khi deploy

1. Vào Firebase Console > Firestore > Rules
2. Đảm bảo rules đã được cập nhật
3. Thử import Excel lại trong app

## Troubleshooting

### Nếu vẫn gặp lỗi 403:

1. **Kiểm tra IAM permissions trong Google Cloud Console:**
   - Vào [IAM & Admin](https://console.cloud.google.com/iam-admin/iam)
   - Tìm account của bạn
   - Đảm bảo có role: **Firebase Admin** hoặc **Owner**

2. **Thử dùng service account:**
   - Tạo service account trong Google Cloud Console
   - Download key file
   - Set environment variable: `GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json`

3. **Liên hệ Firebase Support:**
   - Nếu vẫn không được, có thể cần liên hệ Firebase Support để cấp quyền
