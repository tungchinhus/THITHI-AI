/**
 * ⚠️ BẢO MẬT: File này chứa thông tin nhạy cảm
 * 
 * LƯU Ý:
 * - KHÔNG commit file này nếu chứa API keys thực tế
 * - Sử dụng environment.example.ts làm template
 * - Firebase Config keys có thể public (được bảo vệ bởi Firebase Security Rules)
 * - Gemini API key: Sử dụng Firebase Secrets thay vì hardcode ở đây
 * 
 * Để sử dụng environment variables trong Angular, cần cấu hình build replacement
 * hoặc sử dụng file replacement trong angular.json
 */

export const environment = {
  production: false,
  firebaseConfig: {
    // ✅ Firebase Config - Đã cập nhật từ Firebase Console
    // Lấy từ: https://console.firebase.google.com/project/thithi-3e545/settings/general
    // Lưu ý: Firebase config keys có thể public (được bảo vệ bởi Firebase Security Rules)
    apiKey: "AIzaSyAdKKsicy8uB6Mj2go56UdmnCQ9BUfKBVM",
    authDomain: "thithi-3e545.firebaseapp.com",
    projectId: "thithi-3e545",
    storageBucket: "thithi-3e545.firebasestorage.app",
    messagingSenderId: "106233747074",
    appId: "1:106233747074:web:7a5ec1f02fb0728c75469b",
    measurementId: "G-J8TJTMVSR0"
  },
  // ✅ Firebase Function URL - Đã cập nhật từ deploy
  // URL thực tế: https://chatfunction-7wmcfqhioa-uc.a.run.app
  firebaseFunctionUrl: "https://chatfunction-7wmcfqhioa-uc.a.run.app",
  
  // ⚠️ Gemini API Key - KHÔNG hardcode ở đây!
  // Sử dụng Firebase Secrets: firebase functions:secrets:set GEMINI_API_KEY
  // API key được xử lý ở backend (Firebase Functions), không cần ở đây
  geminiApiKey: "",
  
  // Microsoft Outlook Integration
  // Lấy từ Azure AD App Registration: https://portal.azure.com
  microsoftClientId: "YOUR_MICROSOFT_CLIENT_ID",
  // Tenant ID: "common" = hỗ trợ multi-tenant (bất kỳ Microsoft account nào)
  // Hoặc dùng specific tenant ID nếu chỉ muốn 1 tenant
  microsoftTenantId: "common"
};
