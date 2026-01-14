# 🔒 Hướng dẫn cấu hình Environment

## ⚠️ QUAN TRỌNG VỀ BẢO MẬT

**KHÔNG BAO GIỜ commit API keys vào Git repository!**

## 📁 Các file trong thư mục này

- `environment.example.ts` - File mẫu (có thể commit)
- `environment.ts` - File development (KHÔNG commit nếu chứa keys thực)
- `environment.prod.ts` - File production (KHÔNG commit nếu chứa keys thực)

## 🚀 Cách cấu hình

### Bước 1: Copy file mẫu

```bash
# Nếu chưa có file environment.ts
cp environment.example.ts environment.ts
cp environment.example.ts environment.prod.ts
```

### Bước 2: Điền thông tin Firebase

1. Truy cập: https://console.firebase.google.com/project/YOUR_PROJECT/settings/general
2. Copy các giá trị từ Firebase Console
3. Điền vào `environment.ts` và `environment.prod.ts`

**Lưu ý:** Firebase Config keys (apiKey, authDomain, etc.) có thể public vì được bảo vệ bởi Firebase Security Rules. Tuy nhiên, vẫn nên cẩn thận.

### Bước 3: Cấu hình Gemini API Key

**⚠️ QUAN TRỌNG:** KHÔNG hardcode Gemini API key trong file environment!

**Cách đúng:**
- Sử dụng Firebase Secrets (khuyến nghị):
  ```bash
  firebase functions:secrets:set GEMINI_API_KEY
  ```
- API key được xử lý ở backend (Firebase Functions), không cần ở frontend

### Bước 4: Cấu hình Microsoft Outlook

1. Truy cập: https://portal.azure.com
2. Vào Azure AD App Registration
3. Copy Application (client) ID và Tenant ID
4. Điền vào `microsoftClientId` và `microsoftTenantId`

## 🔍 Kiểm tra trước khi commit

```bash
# Kiểm tra xem có API keys nhạy cảm không
grep -r "AIzaSy[A-Za-z0-9_-]\{35\}" src/environments/
grep -r "YOUR_API_KEY" src/environments/

# Kiểm tra git status
git status

# Xem những file sẽ được commit
git diff --cached src/environments/
```

## ✅ Checklist

- [ ] Đã copy từ `environment.example.ts`
- [ ] Đã điền Firebase config (có thể public)
- [ ] Đã để trống `geminiApiKey` (sử dụng Firebase Secrets)
- [ ] Đã điền Microsoft credentials (nếu cần)
- [ ] Đã kiểm tra không có API keys nhạy cảm
- [ ] Đã test ứng dụng chạy được

## 🚫 Những điều KHÔNG NÊN làm

- ❌ KHÔNG hardcode Gemini API key
- ❌ KHÔNG commit file environment có chứa keys thực (nếu muốn bảo mật tối đa)
- ❌ KHÔNG chia sẻ file environment qua email/chat
- ❌ KHÔNG đặt file environment trong public repository

## 💡 Lưu ý

- **Firebase Config keys** có thể public vì được bảo vệ bởi Firebase Security Rules
- **Gemini API key** phải được bảo vệ, sử dụng Firebase Secrets
- **Microsoft credentials** nên được bảo vệ, có thể sử dụng environment variables

## 📚 Tài liệu tham khảo

- [Firebase Environment Configuration](https://firebase.google.com/docs/hosting/environment-variables)
- [Angular Environment Files](https://angular.io/guide/build#configuring-application-environments)
- [BAO_VE_API_KEY.md](../../BAO_VE_API_KEY.md)
