# Hướng Dẫn Tạo Collection Employees trong Firestore

## Tổng Quan

Collection `employees` chứa thông tin nhân viên được phép sử dụng Telegram Mini App. Chỉ những nhân viên có trong collection này mới có thể đăng nhập.

## Schema Document

Mỗi document trong collection `employees` có cấu trúc:

```json
{
  "phoneNumber": "0901234567",      // string, đã chuẩn hóa (không có +84, khoảng trắng)
  "fullName": "Nguyen Van A",        // string, tên đầy đủ
  "role": "driver",                  // string, "driver" hoặc "admin"
  "telegramId": null,                // string | null, Telegram user ID (ban đầu null)
  "isLinked": false,                 // boolean, đã liên kết với Telegram chưa
  "isActive": true,                  // boolean, nhân viên còn hoạt động không
  "linkedAt": null                   // timestamp | null, thời điểm liên kết (tự động set)
}
```

## Các Bước Tạo Collection

### Bước 1: Truy Cập Firebase Console

1. Mở trình duyệt và truy cập: https://console.firebase.google.com/project/thithi-3e545
2. Chọn project: **thithi-3e545**
3. Vào **Firestore Database** (menu bên trái)

### Bước 2: Tạo Collection

1. Click nút **"Start collection"** (nếu chưa có collection nào)
   - Hoặc click **"Add collection"** (nếu đã có collections)
2. Nhập Collection ID: `employees`
3. Click **"Next"**

### Bước 3: Tạo Document Đầu Tiên

1. **Document ID**: 
   - Chọn **"Auto-ID"** (để Firebase tự tạo ID)
   - Hoặc nhập ID thủ công (ví dụ: `emp_001`)

2. **Thêm các fields**:

   | Field | Type | Value | Mô tả |
   |-------|------|-------|-------|
   | `phoneNumber` | string | `"0901234567"` | Số điện thoại (đã chuẩn hóa) |
   | `fullName` | string | `"Nguyen Van A"` | Tên đầy đủ |
   | `role` | string | `"driver"` | Vai trò: "driver" hoặc "admin" |
   | `telegramId` | string | `null` | Telegram ID (ban đầu null) |
   | `isLinked` | boolean | `false` | Chưa liên kết |
   | `isActive` | boolean | `true` | Đang hoạt động |

3. Click **"Save"**

### Bước 4: Thêm Nhiều Documents

**Cách 1: Thêm từng document**

1. Click **"Add document"** trong collection `employees`
2. Lặp lại Bước 3 cho mỗi nhân viên

**Cách 2: Import từ JSON (nếu có nhiều nhân viên)**

1. Tạo file JSON với format:
   ```json
   [
     {
       "phoneNumber": "0901234567",
       "fullName": "Nguyen Van A",
       "role": "driver",
       "telegramId": null,
       "isLinked": false,
       "isActive": true
     },
     {
       "phoneNumber": "0912345678",
       "fullName": "Tran Thi B",
       "role": "admin",
       "telegramId": null,
       "isLinked": false,
       "isActive": true
     }
   ]
   ```

2. Sử dụng Firebase CLI để import (xem phần Import bên dưới)

## Ví Dụ Cụ Thể

### Ví Dụ 1: Tạo Document Thủ Công

**Document ID**: `emp_001` (hoặc Auto-ID)

**Fields**:
```
phoneNumber: "0901234567"
fullName: "Nguyen Van A"
role: "driver"
telegramId: null
isLinked: false
isActive: true
```

### Ví Dụ 2: Tạo Document cho Admin

**Document ID**: `emp_admin_001`

**Fields**:
```
phoneNumber: "0912345678"
fullName: "Tran Thi B"
role: "admin"
telegramId: null
isLinked: false
isActive: true
```

## Lưu Ý Quan Trọng

### 1. Định Dạng Số Điện Thoại

**✅ ĐÚNG**:
- `"0901234567"`
- `"0912345678"`
- `"0987654321"`

**❌ SAI**:
- `"+84901234567"` (có +84)
- `"84 901 234 567"` (có khoảng trắng)
- `"090-123-4567"` (có dấu gạch ngang)
- `"090 123 4567"` (có khoảng trắng)

**Công thức chuẩn hóa**:
- Bỏ tất cả ký tự không phải số
- Bỏ `84` ở đầu (nếu có)
- Giữ nguyên `0` ở đầu

### 2. Role Values

Chỉ sử dụng các giá trị:
- `"driver"` - Tài xế
- `"admin"` - Quản trị viên
- `"employee"` - Nhân viên (nếu cần)

### 3. Telegram ID

- Ban đầu: `null`
- Sau khi onboarding: String (ví dụ: `"123456789"`)
- Không được để trống string `""`

### 4. Boolean Fields

- `isLinked`: `false` ban đầu, `true` sau khi liên kết
- `isActive`: `true` cho nhân viên đang làm việc, `false` cho nhân viên đã nghỉ

## Import Nhiều Documents (Firebase CLI)

### Bước 1: Tạo File JSON

Tạo file `employees.json`:

```json
{
  "emp_001": {
    "phoneNumber": "0901234567",
    "fullName": "Nguyen Van A",
    "role": "driver",
    "telegramId": null,
    "isLinked": false,
    "isActive": true
  },
  "emp_002": {
    "phoneNumber": "0912345678",
    "fullName": "Tran Thi B",
    "role": "admin",
    "telegramId": null,
    "isLinked": false,
    "isActive": true
  },
  "emp_003": {
    "phoneNumber": "0923456789",
    "fullName": "Le Van C",
    "role": "driver",
    "telegramId": null,
    "isLinked": false,
    "isActive": true
  }
}
```

### Bước 2: Import bằng Firebase CLI

```bash
firebase firestore:import employees.json --collection employees
```

**Lưu ý**: Format JSON phải là object với keys là Document IDs.

## Kiểm Tra Collection

### Cách 1: Firebase Console

1. Vào Firestore Database
2. Click vào collection `employees`
3. Xem danh sách documents
4. Click vào từng document để xem chi tiết

### Cách 2: Firebase CLI

```bash
# Xem tất cả documents trong collection
firebase firestore:get employees
```

## Cập Nhật Document

### Cập Nhật Thủ Công (Firebase Console)

1. Vào collection `employees`
2. Click vào document cần cập nhật
3. Click **"Edit"** hoặc click vào field
4. Sửa giá trị
5. Click **"Update"**

### Cập Nhật Qua Code (Cloud Functions)

Documents sẽ được tự động cập nhật khi:
- User hoàn thành onboarding → `telegramId`, `isLinked`, `linkedAt` được set
- Admin vô hiệu hóa nhân viên → `isActive` = `false`

## Xóa Document

⚠️ **CẨN THẬN**: Xóa document sẽ xóa vĩnh viễn dữ liệu nhân viên.

**Cách xóa**:
1. Vào collection `employees`
2. Click vào document
3. Click **"Delete"**
4. Xác nhận

**Khuyến nghị**: Thay vì xóa, set `isActive: false` để vô hiệu hóa.

## Template Document

Copy template này để tạo document mới:

```json
{
  "phoneNumber": "",
  "fullName": "",
  "role": "driver",
  "telegramId": null,
  "isLinked": false,
  "isActive": true
}
```

## Troubleshooting

### Lỗi: "Collection not found"

**Giải pháp**: Tạo collection `employees` trước (Bước 2)

### Lỗi: "Invalid phone number format"

**Giải pháp**: 
- Kiểm tra định dạng số điện thoại
- Đảm bảo không có `+84`, khoảng trắng, dấu gạch ngang
- Format: `0901234567` (10 chữ số, bắt đầu bằng 0)

### Lỗi: "Role must be driver or admin"

**Giải pháp**: 
- Chỉ dùng `"driver"` hoặc `"admin"`
- Phân biệt chữ hoa/thường (phải lowercase)

### Document không hiển thị sau khi tạo

**Giải pháp**:
- Refresh trang Firebase Console
- Kiểm tra đúng project
- Kiểm tra filters/search

## Checklist Tạo Collection

- [ ] Đã tạo collection `employees`
- [ ] Đã thêm ít nhất 1 document
- [ ] Số điện thoại đúng format (không có +84, khoảng trắng)
- [ ] `telegramId` = `null` ban đầu
- [ ] `isLinked` = `false` ban đầu
- [ ] `isActive` = `true` cho nhân viên đang làm
- [ ] `role` là `"driver"` hoặc `"admin"`

## Next Steps

Sau khi tạo collection:

1. ✅ Test onboarding với số điện thoại trong collection
2. ✅ Kiểm tra document được cập nhật sau onboarding
3. ✅ Test login qua Mini App
4. ✅ Thêm các nhân viên còn lại

Xem thêm:
- `HUONG_DAN_TELEGRAM_AUTH.md` - Hướng dẫn đầy đủ
- `TELEGRAM_AUTH_SETUP.md` - Setup guide
