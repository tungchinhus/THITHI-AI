# 🔧 Fix: Lỗi "The mailbox is either inactive, soft-deleted, or is hosted on-premise"

## ❌ Vấn đề

Khi hỏi về email, AI trả lời: "Mailbox không khả dụng cho REST API"

## 🔍 Nguyên nhân

Lỗi này xảy ra khi:
1. **Mailbox là on-premise Exchange** - Microsoft Graph API chỉ hỗ trợ cloud mailboxes (Office 365, Outlook.com)
2. **Mailbox chưa được kích hoạt cho REST API** - Cần enable REST API trong Exchange settings
3. **Người dùng không có Microsoft 365 license** - Cần license hợp lệ để sử dụng Graph API
4. **Mailbox bị soft-deleted hoặc inactive** - Mailbox đã bị xóa hoặc vô hiệu hóa

## ✅ Giải pháp

### 1. Kiểm tra loại mailbox

- **Cloud mailbox (Office 365/Outlook.com):** ✅ Hỗ trợ Graph API
- **On-premise Exchange:** ❌ Không hỗ trợ Graph API
- **Hybrid Exchange:** ⚠️ Cần cấu hình đặc biệt

### 2. Nếu là on-premise Exchange

**Không thể sử dụng Microsoft Graph API** với on-premise Exchange. Cần:
- Di chuyển mailbox lên Exchange Online (Office 365)
- Hoặc sử dụng Exchange Web Services (EWS) API thay vì Graph API
- Hoặc cấu hình hybrid Exchange với REST API enabled

### 3. Nếu là cloud mailbox nhưng vẫn lỗi

Kiểm tra:
- ✅ User có Microsoft 365 license không?
- ✅ Mailbox có được kích hoạt không?
- ✅ App có quyền `Mail.Read` không?
- ✅ Token có hợp lệ không?

### 4. Cách kiểm tra trong Azure Portal

1. Vào Azure Portal: https://portal.azure.com
2. Vào "Microsoft Entra ID" > "Users"
3. Tìm user và kiểm tra:
   - **Mail:** Có email address không?
   - **Mailbox location:** Cloud hay on-premise?
   - **Licenses:** Có Microsoft 365 license không?

## 🔧 Code đã cải thiện

Code đã được cập nhật để:
1. ✅ Check mailbox settings trước khi gọi messages API
2. ✅ Thử `/me/mailFolders/inbox/messages` trước, fallback về `/me/messages`
3. ✅ Error message rõ ràng hơn với hướng dẫn fix
4. ✅ Logging chi tiết để debug

## 📝 Test

Sau khi deploy, test lại:
1. Hỏi: "có email mới không?"
2. Nếu vẫn lỗi, xem Firebase logs để biết chi tiết
3. Kiểm tra user info và mailbox settings trong logs

## ⚠️ Lưu ý

- **On-premise Exchange:** Không thể fix bằng code, cần migrate lên cloud
- **Cloud mailbox:** Có thể fix bằng cách enable REST API hoặc cấp license
- **Hybrid:** Cần cấu hình Exchange hybrid với REST API enabled

