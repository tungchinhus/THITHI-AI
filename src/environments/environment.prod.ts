/**
 * ⚠️ BẢO MẬT: File này chứa thông tin nhạy cảm cho Production
 * 
 * LƯU Ý:
 * - KHÔNG commit file này nếu chứa API keys thực tế
 * - Sử dụng environment.example.ts làm template
 * - Sử dụng environment variables hoặc build-time replacement
 */

export const environment = {
  production: true,
  firebaseConfig: {
    // ⚠️ Firebase Config - Có thể public nhưng nên lấy từ environment variable
    // Lấy từ: https://console.firebase.google.com/project/YOUR_PROJECT/settings/general
    // Lưu ý: Angular không hỗ trợ process.env trong browser
    // Sử dụng file replacement trong angular.json để thay thế giá trị khi build
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  },
  // ⚠️ QUAN TRỌNG: Cập nhật URL Firebase Function của bạn
  // Format: https://REGION-PROJECT_ID.cloudfunctions.net/FUNCTION_NAME
  // Ví dụ: https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction
  // Xem file HUONG_DAN_CAU_HINH_FUNCTION.md để biết chi tiết
  // Lưu ý: Angular không hỗ trợ process.env trong browser
  // Sử dụng file replacement trong angular.json để thay thế giá trị khi build
  firebaseFunctionUrl: "YOUR_FIREBASE_FUNCTION_URL",
  
  // ⚠️ Gemini API Key - KHÔNG hardcode ở đây!
  // Sử dụng Firebase Secrets: firebase functions:secrets:set GEMINI_API_KEY
  // API key được xử lý ở backend (Firebase Functions), không cần ở đây
  geminiApiKey: "",
  
  // Microsoft Outlook Integration
  // Lấy từ Azure AD App Registration: https://portal.azure.com
  // Lưu ý: Angular không hỗ trợ process.env trong browser
  // Sử dụng file replacement trong angular.json để thay thế giá trị khi build
  microsoftClientId: "YOUR_MICROSOFT_CLIENT_ID",
  microsoftTenantId: "YOUR_MICROSOFT_TENANT_ID",
  
  // .NET Backend API URL
  backendApiUrl: "http://localhost:5000"
};

