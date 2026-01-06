# 🧪 Test Email Access sau khi deploy

## ✅ Đã deploy thành công

Function đã được deploy với:
- ✅ Code mới có logging chi tiết
- ✅ Cải thiện nhận diện câu hỏi về email
- ✅ Đã fix lỗi secret `MICROSOFT_TENANT_ID`

## 🧪 Test Steps

<reproduction_steps>
1. Đảm bảo app đang chạy (`npm start` hoặc `ng serve`)
2. Đảm bảo đã đăng nhập Microsoft (click nút "Outlook" nếu chưa)
3. Mở một terminal mới để xem Firebase Functions logs
4. Trong chat, gõ câu hỏi: "trong hợp mail tôi co mail nào mới không?"
5. Gửi message (Enter hoặc click Send)
6. Trong terminal, chạy: `firebase functions:log --only chatFunction --limit 50`
7. Quan sát logs để xem:
   - Backend có nhận được token không
   - Backend có nhận diện được câu hỏi về email không
   - Graph API có được gọi không
   - Có lỗi gì không
</reproduction_steps>

## 📊 Logs cần tìm

Trong Firebase Functions logs, tìm các dòng sau:

1. **`📥 Backend received request`** - Xác nhận backend nhận được request và token
2. **`📧 Email question check`** - Xác nhận backend check câu hỏi về email
3. **`🔍 isEmailRelatedQuestion`** - Xem keywords nào được match
4. **`📧 Calling searchOutlookEmails`** - Xác nhận Graph API được gọi
5. **`📡 Graph API response`** - Xem kết quả từ Graph API
6. **`✅ Email context added to prompt`** - Xác nhận email context được thêm vào prompt

## 🔍 Nếu vẫn không hoạt động

Kiểm tra logs để xem:
- Token có được gửi không?
- Câu hỏi có được nhận diện là email question không?
- Graph API có được gọi không?
- Có lỗi gì trong quá trình gọi Graph API không?

