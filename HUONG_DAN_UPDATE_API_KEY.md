# 🔐 HƯỚNG DẪN CẬP NHẬT API KEY (KHÔNG PUBLISH)

## ⚠️ QUAN TRỌNG
**KHÔNG BAO GIỜ** hardcode API key vào code hoặc commit vào Git!

## ✅ CÁCH 1: Sử dụng Firebase Secrets (KHUYẾN NGHỊ)

### Bước 1: Cài đặt Firebase CLI (nếu chưa có)

#### Trên Windows (PowerShell):
```powershell
# Cài đặt Node.js trước (nếu chưa có)
# Tải từ: https://nodejs.org/

# Sau đó cài Firebase CLI
npm install -g firebase-tools

# Kiểm tra đã cài thành công
firebase --version

# Nếu lệnh firebase không hoạt động, thử:
npx firebase-tools --version
# Hoặc đóng và mở lại PowerShell/terminal để refresh PATH
```

#### Trên macOS/Linux:
```bash
npm install -g firebase-tools
firebase --version

# Nếu lệnh firebase không hoạt động, thử:
npx firebase-tools --version
```

### Bước 2: Đăng nhập Firebase
```bash
# Nếu firebase command hoạt động:
firebase login

# Nếu không, dùng npx:
npx firebase-tools login
```

### Bước 3: Chọn project Firebase
```bash
# Vào thư mục project
cd D:\Project\thibidi\THITHI-AI

# Chọn project Firebase
firebase use --add
# Hoặc nếu đã có project:
firebase use YOUR_PROJECT_ID

# Nếu firebase command không hoạt động, dùng npx:
# npx firebase-tools use --add
# npx firebase-tools use YOUR_PROJECT_ID
```

### Bước 4: Set API key vào Firebase Secrets
```bash
# Cách 1: Nhập trực tiếp (Windows PowerShell)
echo "AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A" | firebase functions:secrets:set GEMINI_API_KEY
# Nếu firebase command không hoạt động:
# echo "AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A" | npx firebase-tools functions:secrets:set GEMINI_API_KEY

# Cách 2: Từ file (an toàn hơn)
# Tạo file tạm (sẽ xóa sau)
echo "AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A" > temp-api-key.txt
Get-Content temp-api-key.txt | firebase functions:secrets:set GEMINI_API_KEY
# Xóa file tạm ngay sau khi set
Remove-Item temp-api-key.txt

# Cách 3: Nhập thủ công (an toàn nhất)
firebase functions:secrets:set GEMINI_API_KEY
# Sau đó paste API key và nhấn Enter, rồi Ctrl+Z (Windows) hoặc Ctrl+D (Linux/Mac)
```

### Bước 5: Kiểm tra đã set thành công
```bash
# Xem secret đã được set (sẽ hiển thị masked value)
firebase functions:secrets:access GEMINI_API_KEY
```

### Bước 6: Deploy lại Functions (nếu cần)
```bash
firebase deploy --only functions
```

## ✅ CÁCH 2: Sử dụng Google Cloud Console (Nếu không có Firebase CLI)

### Bước 1: Truy cập Google Cloud Console
1. Vào: https://console.cloud.google.com/
2. Chọn project Firebase của bạn

### Bước 2: Vào Secret Manager
1. Vào menu **Security** → **Secret Manager**
2. Hoặc truy cập trực tiếp: https://console.cloud.google.com/security/secret-manager

### Bước 3: Tạo hoặc cập nhật Secret
1. Nếu chưa có secret `GEMINI_API_KEY`:
   - Click **CREATE SECRET**
   - Name: `GEMINI_API_KEY`
   - Secret value: `AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A`
   - Click **CREATE SECRET**

2. Nếu đã có secret:
   - Click vào secret `GEMINI_API_KEY`
   - Click **ADD NEW VERSION**
   - Paste API key mới: `AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A`
   - Click **ADD VERSION**

### Bước 4: Cấp quyền cho Firebase Functions
1. Vào **IAM & Admin** → **Service Accounts**
2. Tìm service account của Firebase Functions (thường có tên như `PROJECT_ID@appspot.gserviceaccount.com`)
3. Click vào service account → **KEYS** tab
4. Đảm bảo service account có quyền **Secret Manager Secret Accessor**

## ✅ CÁCH 3: Sử dụng Environment Variable (Chỉ cho Development Local)

⚠️ **LƯU Ý:** Chỉ dùng cho development local, KHÔNG dùng cho production!

### Bước 1: Tạo file `.env` (đã có trong .gitignore)
```bash
# Tạo file .env trong thư mục functions/
cd functions
echo "GEMINI_API_KEY=AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A" > .env
```

### Bước 2: Load environment variable trong code
File `functions/index.js` đã sử dụng `process.env.GEMINI_API_KEY` từ Firebase Secrets, nên không cần thay đổi code.

## 🔍 KIỂM TRA SAU KHI CẬP NHẬT

### 1. Kiểm tra secret đã được set:
```bash
firebase functions:secrets:access GEMINI_API_KEY
```

### 2. Test function (nếu đã deploy):
```bash
# Gọi health check
curl https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/healthCheck

# Hoặc test chat function
curl -X POST https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/chatFunction \
  -H "Content-Type: application/json" \
  -d '{"question":"Xin chào"}'
```

### 3. Kiểm tra logs:
```bash
firebase functions:log --only chatFunction
```

## 🚫 NHỮNG ĐIỀU KHÔNG NÊN LÀM

### ❌ KHÔNG hardcode API key trong code:
```javascript
// ❌ SAI - KHÔNG LÀM THẾ NÀY!
const apiKey = 'AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A';
```

### ❌ KHÔNG commit file chứa API key:
- `functions/.env`
- `check-api-key.js` (nếu có hardcode)
- Bất kỳ file nào chứa API key thực tế

### ❌ KHÔNG chia sẻ API key qua:
- Email
- Chat/Slack
- GitHub Issues/PRs
- Screenshots

## 📋 CHECKLIST

- [ ] Đã cài Firebase CLI
- [ ] Đã đăng nhập Firebase (`firebase login`)
- [ ] Đã chọn đúng project (`firebase use PROJECT_ID`)
- [ ] Đã set API key vào Firebase Secrets
- [ ] Đã kiểm tra secret đã được set thành công
- [ ] Đã deploy lại functions (nếu cần)
- [ ] Đã test function hoạt động
- [ ] Đã xóa file tạm chứa API key (nếu có)
- [ ] Đã kiểm tra không có API key trong code

## 🔗 TÀI LIỆU THAM KHẢO

- [Firebase Secrets Documentation](https://firebase.google.com/docs/functions/config-env)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)
- [BAO_VE_API_KEY.md](./BAO_VE_API_KEY.md) - Hướng dẫn bảo vệ API keys

## 💡 LƯU Ý

- API key của bạn: `AIzaSyB1Bzqz2KAbA2rOWTFzyrNRr05zxguxq3A`
- Function code đã sử dụng `process.env.GEMINI_API_KEY` từ Firebase Secrets
- Không cần thay đổi code, chỉ cần set secret là đủ
- Secret sẽ tự động được inject vào `process.env` khi function chạy
