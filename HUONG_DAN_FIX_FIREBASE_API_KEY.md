# 🔧 HƯỚNG DẪN FIX LỖI FIREBASE API KEY

## ⚠️ LỖI HIỆN TẠI

```
[400] API key not valid. Please pass a valid API key.
Firebase Analytics: Dynamic config fetch failed
Firebase Installations: Create Installation request failed
```

## 🔍 NGUYÊN NHÂN

File `src/environments/environment.ts` đang có placeholder `"YOUR_FIREBASE_API_KEY"` thay vì Firebase API key thực tế.

## ✅ CÁCH FIX

### Bước 1: Lấy Firebase Config từ Firebase Console

1. Truy cập: https://console.firebase.google.com/
2. Chọn project của bạn: **thithi-3e545**
3. Vào **Project Settings** (⚙️ Settings > Project settings)
4. Scroll xuống phần **Your apps**
5. Nếu chưa có app, click **Add app** > Chọn **Web** (</> icon)
6. Copy các giá trị từ Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",  // ← Copy giá trị này
  authDomain: "thithi-3e545.firebaseapp.com",
  projectId: "thithi-3e545",
  storageBucket: "thithi-3e545.appspot.com",
  messagingSenderId: "106233747074",
  appId: "1:106233747074:web:...",
  measurementId: "G-..."  // ← Có thể không có nếu chưa enable Analytics
};
```

### Bước 2: Cập nhật file environment.ts

Mở file `src/environments/environment.ts` và thay thế các giá trị placeholder:

```typescript
export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: "AIza...",  // ← Thay bằng API key thực tế
    authDomain: "thithi-3e545.firebaseapp.com",  // ← Thay bằng domain thực tế
    projectId: "thithi-3e545",  // ← Thay bằng project ID thực tế
    storageBucket: "thithi-3e545.appspot.com",  // ← Thay bằng storage bucket thực tế
    messagingSenderId: "106233747074",  // ← Thay bằng sender ID thực tế
    appId: "1:106233747074:web:...",  // ← Thay bằng app ID thực tế
    measurementId: "G-..."  // ← Thay bằng measurement ID (nếu có)
  },
  firebaseFunctionUrl: "https://chatfunction-7wmcfqhioa-uc.a.run.app",  // ← URL function thực tế
  geminiApiKey: "",  // ← Để trống, sử dụng Firebase Secrets
  microsoftClientId: "YOUR_MICROSOFT_CLIENT_ID",
  microsoftTenantId: "common"
};
```

### Bước 3: Cập nhật firebaseFunctionUrl

URL Firebase Function của bạn (từ deploy trước):
```
https://chatfunction-7wmcfqhioa-uc.a.run.app
```

Hoặc nếu dùng format cũ:
```
https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction
```

### Bước 4: Rebuild và test

```bash
npm run build
# hoặc
ng serve
```

## 📋 CHECKLIST

- [ ] Đã lấy Firebase config từ Firebase Console
- [ ] Đã cập nhật `apiKey` trong `environment.ts`
- [ ] Đã cập nhật `authDomain` trong `environment.ts`
- [ ] Đã cập nhật `projectId` trong `environment.ts`
- [ ] Đã cập nhật `storageBucket` trong `environment.ts`
- [ ] Đã cập nhật `messagingSenderId` trong `environment.ts`
- [ ] Đã cập nhật `appId` trong `environment.ts`
- [ ] Đã cập nhật `measurementId` (nếu có) trong `environment.ts`
- [ ] Đã cập nhật `firebaseFunctionUrl` trong `environment.ts`
- [ ] Đã rebuild và test lại

## ⚠️ LƯU Ý

1. **Firebase Config keys có thể public** - Chúng được bảo vệ bởi Firebase Security Rules
2. **KHÔNG commit file `environment.ts`** nếu chứa keys thực tế (nếu muốn commit, dùng `.gitignore`)
3. **Gemini API key** vẫn được lưu an toàn trong Firebase Secrets, không cần thay đổi

## 🔗 TÀI LIỆU THAM KHẢO

- [Firebase Console](https://console.firebase.google.com/project/thithi-3e545/settings/general)
- [Firebase Documentation](https://firebase.google.com/docs/web/setup)
