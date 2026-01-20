# Hướng Dẫn: Setup Google Vision API cho OCR Scanned PDFs

## 🎯 Tổng Quan

Hệ thống đã được tích hợp Google Vision API để tự động OCR (Optical Character Recognition) các PDF scanned images. Khi phát hiện PDF là scanned (không có text layer), hệ thống sẽ tự động dùng Google Vision API để extract text.

## 📋 Yêu Cầu

1. **Google Cloud Project** với Vision API enabled
2. **Service Account Key** hoặc **Application Default Credentials**
3. **Billing enabled** trên Google Cloud Project (Vision API có free tier: 1000 requests/tháng)

## 🚀 Cách Setup

### Cách 1: Dùng Service Account Key (Khuyến nghị cho local development)

1. **Tạo Service Account:**
   - Vào [Google Cloud Console](https://console.cloud.google.com/)
   - Chọn project của bạn
   - Vào **IAM & Admin** > **Service Accounts**
   - Click **Create Service Account**
   - Đặt tên: `pdf-ocr-service`
   - Click **Create and Continue**
   - Chọn role: **Cloud Vision API User**
   - Click **Done**

2. **Tạo Key:**
   - Click vào service account vừa tạo
   - Vào tab **Keys**
   - Click **Add Key** > **Create new key**
   - Chọn **JSON**
   - Download file JSON về máy

3. **Set Environment Variable:**
   ```cmd
   REM Windows CMD
   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\service-account-key.json
   
   REM PowerShell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\service-account-key.json"
   ```

4. **Hoặc đặt trong batch file:**
   ```cmd
   @echo off
   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\service-account-key.json
   node test-folder-ingest.js
   ```

### Cách 2: Dùng Application Default Credentials (Cho Firebase/Cloud Functions)

Nếu deploy lên Firebase Functions hoặc Google Cloud, có thể dùng Application Default Credentials:

```bash
# Login với Google Cloud
gcloud auth application-default login
```

## 📦 Cài Đặt Dependencies

Sau khi setup credentials, cài đặt package mới:

```cmd
cd C:\MyData\projects\THITHI\THIHI_AI\functions
npm install
```

## ✅ Kiểm Tra Setup

Chạy ingest folder và kiểm tra logs:

```cmd
cd C:\MyData\projects\THITHI\THIHI_AI\functions
ingest-folder-simple.bat
```

Nếu setup đúng, bạn sẽ thấy:
```
📸 Detected scanned PDF: filename.pdf
   Attempting OCR with Google Vision API...
✅ OCR successful! Extracted XXXX characters
```

Nếu setup sai, bạn sẽ thấy:
```
⚠️  OCR failed: Google Vision API client not initialized
```

## 💰 Chi Phí

- **Free Tier:** 1000 requests/tháng
- **Sau free tier:** $1.50 per 1000 requests
- **Chi tiết:** [Google Vision API Pricing](https://cloud.google.com/vision/pricing)

## 🔍 Troubleshooting

### Lỗi: "Google Vision API client not initialized"

**Nguyên nhân:** Chưa set `GOOGLE_APPLICATION_CREDENTIALS` hoặc credentials không hợp lệ

**Giải pháp:**
1. Kiểm tra file JSON key có tồn tại không
2. Kiểm tra environment variable đã set chưa: `echo %GOOGLE_APPLICATION_CREDENTIALS%`
3. Kiểm tra service account có quyền **Cloud Vision API User** không

### Lỗi: "API key not valid"

**Nguyên nhân:** Service account key không hợp lệ hoặc đã bị revoke

**Giải pháp:**
1. Tạo lại service account key
2. Đảm bảo Vision API đã được enable trong project

### Lỗi: "Billing not enabled"

**Nguyên nhân:** Google Cloud Project chưa enable billing

**Giải pháp:**
1. Vào Google Cloud Console
2. Vào **Billing**
3. Link billing account với project

## 📝 Lưu Ý

1. **Security:** Không commit service account key vào Git
2. **Performance:** OCR có thể mất vài giây cho mỗi PDF
3. **Quality:** OCR quality phụ thuộc vào chất lượng scan (resolution, contrast, etc.)
4. **Language:** Google Vision API tự động detect ngôn ngữ, nhưng có thể set explicit language hint nếu cần

## 🎉 Kết Luận

Sau khi setup xong, hệ thống sẽ tự động:
- ✅ Detect scanned PDFs
- ✅ OCR bằng Google Vision API
- ✅ Extract text và import vào database
- ✅ Fallback về text extraction thông thường nếu OCR fail
