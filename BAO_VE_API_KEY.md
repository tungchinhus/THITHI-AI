# 🔒 HƯỚNG DẪN BẢO VỆ API KEYS

## ⚠️ VẤN ĐỀ QUAN TRỌNG

**KHÔNG BAO GIỜ** commit API keys vào Git repository! API keys bị lộ có thể:
- Bị lạm dụng bởi người khác
- Gây tốn chi phí không kiểm soát
- Vi phạm chính sách bảo mật
- Bị Google Cloud Platform phát hiện và cảnh báo

## ✅ CÁC CÁCH BẢO VỆ API KEYS

### 1. **Sử dụng Environment Variables**

#### Trong Firebase Functions:
```bash
# Set secret (khuyến nghị)
echo YOUR_API_KEY | firebase functions:secrets:set GEMINI_API_KEY

# Hoặc sử dụng trong code
const apiKey = process.env.GEMINI_API_KEY;
```

#### Trong Angular/Node.js:
```bash
# Tạo file .env (đã được thêm vào .gitignore)
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Sử dụng trong code
import * as dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.GEMINI_API_KEY;
```

### 2. **Sử dụng Command Line Arguments**

```bash
# Thay vì hardcode trong file
node check-api-key.js YOUR_API_KEY

# Hoặc từ environment variable
export GEMINI_API_KEY=YOUR_API_KEY
node check-api-key.js
```

### 3. **Sử dụng Firebase Secrets (Khuyến nghị cho Production)**

```bash
# Set secret
echo YOUR_API_KEY | firebase functions:secrets:set GEMINI_API_KEY

# Access trong code
const apiKey = process.env.GEMINI_API_KEY;

# Deploy với secret
firebase deploy --only functions
```

### 4. **Sử dụng Google Secret Manager**

```bash
# Tạo secret trong Secret Manager
gcloud secrets create GEMINI_API_KEY --data-file=-

# Access trong code
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({
  name: 'projects/YOUR_PROJECT/secrets/GEMINI_API_KEY/versions/latest'
});
const apiKey = version.payload.data.toString();
```

## 🚫 NHỮNG ĐIỀU KHÔNG NÊN LÀM

### ❌ KHÔNG hardcode API keys trong code:
```javascript
// ❌ SAI - KHÔNG LÀM THẾ NÀY!
const apiKey = 'YOUR_API_KEY_HERE'; // API key bị lộ sẽ bị lạm dụng!
```

### ❌ KHÔNG commit file chứa API keys:
- `check-api-key.js` (nếu có hardcode key)
- `.env` files
- `*credentials*.js`
- `*secret*.js`

### ❌ KHÔNG chia sẻ API keys qua:
- Email
- Chat/Slack
- GitHub Issues/PRs
- Screenshots

## ✅ CHECKLIST TRƯỚC KHI COMMIT

- [ ] Đã xóa tất cả API keys hardcoded
- [ ] Đã thêm file chứa keys vào `.gitignore`
- [ ] Đã sử dụng environment variables hoặc secrets
- [ ] Đã test code vẫn hoạt động với API key từ environment
- [ ] Đã kiểm tra `git status` để đảm bảo không commit file nhạy cảm

## 🔧 NẾU API KEY ĐÃ BỊ LỘ

### Bước 1: Regenerate API Key ngay lập tức
1. Truy cập: https://console.cloud.google.com/apis/credentials
2. Tìm API key bị lộ
3. Click "Edit" → "Regenerate Key"
4. Lưu API key mới ở nơi an toàn

### Bước 2: Xóa API key cũ khỏi Git history

⚠️ **CẢNH BÁO QUAN TRỌNG:**
- Thao tác này sẽ **thay đổi toàn bộ Git history**
- **Backup repository** trước khi thực hiện
- **Thông báo** cho tất cả team members trước khi force push
- Nếu repository đã public và có nhiều người dùng, cân nhắc tạo repository mới

#### Phương pháp 1: Sử dụng git-filter-repo (Khuyến nghị - Hiện đại hơn)

```bash
# Cài đặt git-filter-repo (nếu chưa có)
pip install git-filter-repo
# hoặc
brew install git-filter-repo  # macOS

# Backup repository trước
git clone --mirror https://github.com/tungchinhus/THITHI-AI.git backup-repo.git

# Xóa file khỏi toàn bộ history
git filter-repo --path check-api-key.js --invert-paths

# Hoặc xóa API key khỏi nội dung file (nếu file vẫn cần giữ)
# Thay YOUR_LEAKED_API_KEY bằng API key thực tế bị lộ
git filter-repo --replace-text <(echo "YOUR_LEAKED_API_KEY==>REMOVED_API_KEY")

# Force push (chỉ làm nếu chắc chắn!)
git push origin --force --all
git push origin --force --tags
```

#### Phương pháp 2: Sử dụng git filter-branch (Cách cũ)

**Giải thích các tham số:**
- `--force`: Ghi đè backup cũ nếu đã tồn tại
- `--index-filter`: Chạy lệnh trên staging area (nhanh hơn `--tree-filter`)
- `git rm --cached --ignore-unmatch`: Xóa file khỏi index, `--ignore-unmatch` không báo lỗi nếu file không tồn tại
- `--prune-empty`: Xóa commit trống sau khi filter
- `--tag-name-filter cat`: Giữ nguyên tên tags
- `-- --all`: Áp dụng cho tất cả branches và tags

```bash
# Bước 1: Backup trước!
git clone --mirror https://github.com/tungchinhus/THITHI-AI.git backup-repo.git

# Bước 2: Kiểm tra file có tồn tại trong history không
git log --all --full-history -- check-api-key.js
# Thay YOUR_LEAKED_API_KEY bằng API key thực tế bị lộ
git log -S "YOUR_LEAKED_API_KEY" --all

# Bước 3: Xóa file khỏi Git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch check-api-key.js" \
  --prune-empty --tag-name-filter cat -- --all

# Bước 4: Dọn dẹp refs backup (xóa backup refs được tạo tự động)
# Git filter-branch tự động tạo backup refs trong refs/original/
# Lệnh này sẽ xóa tất cả các backup refs đó để giải phóng không gian
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

# Bước 5: Garbage collection (xóa objects không còn được reference)
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Bước 6: Kiểm tra lại xem file đã bị xóa chưa
git log --all --full-history -- check-api-key.js
# Nếu không có output, file đã được xóa thành công

# Bước 7: Force push (chỉ làm nếu chắc chắn!)
git push origin --force --all
git push origin --force --tags
```

**Lưu ý:** Nếu muốn xóa API key khỏi nội dung file (giữ file, chỉ xóa key), sử dụng:

```bash
# Tạo script để thay thế API key
git filter-branch --force --tree-filter \
  "if [ -f check-api-key.js ]; then \
    sed -i 's/YOUR_API_KEY_HERE/REMOVED_API_KEY/g' check-api-key.js; \
  fi" \
  --prune-empty --tag-name-filter cat -- --all
```

#### Phương pháp 3: Xóa API key khỏi nội dung file (Giữ file, chỉ xóa key)

```bash
# Sử dụng BFG Repo-Cleaner (nhanh hơn)
# Download: https://rtyley.github.io/bfg-repo-cleaner/

# Tạo file replacements.txt (thay YOUR_LEAKED_API_KEY bằng API key thực tế)
echo "YOUR_LEAKED_API_KEY==>REMOVED_API_KEY" > replacements.txt

# Chạy BFG
java -jar bfg.jar --replace-text replacements.txt

# Cleanup
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

#### Sau khi xóa khỏi Git history:

1. **Thông báo team members** để họ re-clone repository
2. **Kiểm tra** xem API key đã được xóa hoàn toàn:
   ```bash
   git log --all --full-history -- check-api-key.js
   # Thay YOUR_LEAKED_API_KEY bằng API key thực tế bị lộ
   git log -S "YOUR_LEAKED_API_KEY" --all
   ```
3. **Xóa local repository cũ** và clone lại:
   ```bash
   cd ..
   rm -rf THITHI-AI
   git clone https://github.com/tungchinhus/THITHI-AI.git
   ```

### Bước 3: Cập nhật code để sử dụng API key mới
```bash
# Set API key mới vào Firebase Secrets
echo YOUR_NEW_API_KEY | firebase functions:secrets:set GEMINI_API_KEY

# Deploy lại
firebase deploy --only functions
```

### Bước 4: Kiểm tra usage trong Google Cloud Console
- Xem logs: https://console.cloud.google.com/logs
- Kiểm tra billing: https://console.cloud.google.com/billing
- Xem API usage: https://console.cloud.google.com/apis/dashboard

## 📋 CẤU HÌNH .GITIGNORE

File `.gitignore` đã được cấu hình để bỏ qua:
- `.env` files
- `*-api-key.js` files
- `*credentials*.js` files
- `*secret*.js` files

## 🔍 KIỂM TRA TRƯỚC KHI PUSH

```bash
# Kiểm tra xem có file nào chứa API key không
# Tìm pattern API key Google (AIzaSy...)
grep -r "AIzaSy[A-Za-z0-9_-]\{35\}" . --exclude-dir=node_modules --exclude-dir=.git
# Hoặc tìm pattern cụ thể nếu biết API key bị lộ
grep -r "YOUR_LEAKED_API_KEY" . --exclude-dir=node_modules --exclude-dir=.git

# Kiểm tra git status
git status

# Xem những file sẽ được commit
git diff --cached
```

## 📚 TÀI LIỆU THAM KHẢO

- [Google Cloud API Key Security](https://cloud.google.com/docs/authentication/api-keys)
- [Firebase Secrets](https://firebase.google.com/docs/functions/config-env)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security/secret-scanning)

## 💡 LƯU Ý

- **Firebase Config Keys** (trong `environment.ts`) có thể public được vì chúng được bảo vệ bởi Firebase Security Rules
- **API Keys** (như Gemini API key) **KHÔNG BAO GIỜ** được public
- Luôn sử dụng **Firebase Secrets** hoặc **Secret Manager** cho production
- Sử dụng **environment variables** cho development local
