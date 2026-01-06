# 📁 Hướng dẫn Thêm File vào OneDrive để Test

## 🎯 Mục đích

Để test tính năng OneDrive integration, bạn cần có file trong OneDrive. Hướng dẫn này sẽ giúp bạn thêm các loại file khác nhau để test.

## 📋 Cách 1: Upload File qua Web (Khuyến nghị)

### Bước 1: Mở OneDrive Web

1. Truy cập: https://onedrive.live.com
2. Đăng nhập bằng Microsoft account của bạn (cùng account đã đăng nhập trong app)

### Bước 2: Upload File

1. Click nút **"Upload"** hoặc **"Tải lên"** ở thanh menu trên
2. Chọn **"Files"** hoặc **"Folders"**
3. Chọn file từ máy tính của bạn
4. Đợi upload hoàn tất

### Bước 3: Tạo File Mới (Nếu chưa có)

Nếu bạn chưa có file để test, có thể tạo file mới:

#### Tạo File Word (.docx):
1. Click **"New"** > **"Word document"**
2. Gõ một số nội dung test, ví dụ:
   ```
   Đây là file Word test
   Nội dung: Hướng dẫn sử dụng OneDrive
   Ngày tạo: [ngày hiện tại]
   ```
3. Click **"Save"** hoặc **"Lưu"**
4. Đặt tên file, ví dụ: `TestWord.docx`

#### Tạo File Excel (.xlsx):
1. Click **"New"** > **"Excel workbook"**
2. Nhập một số dữ liệu test:
   - A1: Tên
   - B1: Tuổi
   - A2: Nguyễn Văn A
   - B2: 25
3. Click **"Save"** hoặc **"Lưu"**
4. Đặt tên file, ví dụ: `TestExcel.xlsx`

#### Tạo File Text (.txt):
1. Click **"New"** > **"Text document"**
2. Gõ nội dung:
   ```
   Đây là file text test
   Nội dung đơn giản để test OneDrive integration
   ```
3. Click **"Save"** hoặc **"Lưu"**
4. Đặt tên file, ví dụ: `TestText.txt`

## 📋 Cách 2: Upload File qua OneDrive App (Desktop/Mobile)

### Desktop App:
1. Cài đặt OneDrive app từ Microsoft Store hoặc https://onedrive.live.com/about/download/
2. Đăng nhập bằng Microsoft account
3. Kéo thả file vào thư mục OneDrive trên máy tính
4. File sẽ tự động sync lên cloud

### Mobile App:
1. Cài đặt OneDrive app trên điện thoại
2. Đăng nhập
3. Click nút **"+"** > **"Upload"**
4. Chọn file từ điện thoại

## 📋 Cách 3: Tạo File Test Nhanh (Dùng Notepad/Word)

### Tạo File Word Test:
1. Mở Microsoft Word (hoặc Word Online)
2. Tạo document mới với nội dung:
   ```
   Tài liệu Test OneDrive
   
   Đây là file Word được tạo để test tính năng tìm kiếm và tóm tắt file trong OneDrive.
   
   Nội dung chính:
   - Mục đích: Test OneDrive integration
   - Tính năng: Tìm kiếm file, tóm tắt nội dung
   - Ngày tạo: [ngày hiện tại]
   ```
3. Lưu file với tên: `TestWord.docx`
4. Upload lên OneDrive

### Tạo File Excel Test:
1. Mở Microsoft Excel (hoặc Excel Online)
2. Tạo bảng dữ liệu:
   ```
   | Tên      | Tuổi | Email              |
   |----------|------|-------------------|
   | Nguyễn A | 25   | a@example.com     |
   | Trần B   | 30   | b@example.com     |
   | Lê C     | 28   | c@example.com     |
   ```
3. Lưu file với tên: `TestExcel.xlsx`
4. Upload lên OneDrive

### Tạo File PDF Test:
1. Tạo file Word hoặc Text như trên
2. Click **"File"** > **"Save As"** > Chọn **"PDF"**
3. Hoặc dùng online converter: https://www.ilovepdf.com/word-to-pdf
4. Upload PDF lên OneDrive

## 🧪 Test Sau Khi Upload

Sau khi upload file, test trong app:

### Test 1: Tìm tất cả file
```
Hỏi: "Tìm file trong OneDrive của tôi"
```

### Test 2: Tìm file Word
```
Hỏi: "Tìm file Word trong OneDrive"
```

### Test 3: Tìm file Excel
```
Hỏi: "Tìm file Excel trong OneDrive"
```

### Test 4: Tìm file cụ thể
```
Hỏi: "Tìm file TestWord trong OneDrive"
```

### Test 5: Tóm tắt file
```
Hỏi: "Tóm tắt file TestWord trong OneDrive"
Hỏi: "Nội dung file TestExcel là gì?"
```

## 📝 File Test Mẫu (Có thể tạo)

### File Word Test (TestWord.docx):
- Nội dung: Hướng dẫn sử dụng, báo cáo, tài liệu
- Mục đích: Test đọc và tóm tắt Word

### File Excel Test (TestExcel.xlsx):
- Nội dung: Bảng dữ liệu, danh sách, thống kê
- Mục đích: Test đọc và tóm tắt Excel

### File PDF Test (TestPDF.pdf):
- Nội dung: Tài liệu PDF
- Mục đích: Test đọc và tóm tắt PDF

### File Text Test (TestText.txt):
- Nội dung: Văn bản đơn giản
- Mục đích: Test đọc và tóm tắt text

## ⚠️ Lưu ý

1. **Đảm bảo đã đăng nhập Microsoft** trong app trước khi test
2. **File phải nằm trong OneDrive root** hoặc thư mục chính (function hiện tại chỉ tìm trong root và recent files)
3. **Đợi vài giây** sau khi upload để file được sync
4. **Refresh trang app** nếu không thấy file mới

## 🔍 Kiểm tra File đã Upload

1. Vào https://onedrive.live.com
2. Kiểm tra file có trong OneDrive không
3. Đảm bảo file không bị ẩn hoặc trong thư mục con

## 🆘 Nếu không thấy File

1. **Kiểm tra account**: Đảm bảo đăng nhập cùng Microsoft account trong app và OneDrive web
2. **Kiểm tra sync**: Đợi vài phút để file sync
3. **Refresh app**: Refresh trang app và thử lại
4. **Kiểm tra permissions**: Đảm bảo đã cấp quyền Files.Read và Files.Read.All trong Azure AD

## 📊 Checklist Test

Sau khi upload file, test các câu hỏi sau:

- [ ] "Tìm file trong OneDrive của tôi" → Liệt kê tất cả file
- [ ] "Tìm file Word trong OneDrive" → Chỉ hiển thị file Word
- [ ] "Tìm file Excel trong OneDrive" → Chỉ hiển thị file Excel
- [ ] "Tóm tắt file [tên file] trong OneDrive" → Tóm tắt nội dung file
- [ ] "File nào mới nhất trong OneDrive?" → Hiển thị file mới nhất



