export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: "AIzaSyAdKKsicy8uB6Mj2go56UdmnCQ9BUfKBVM",
    authDomain: "thithi-3e545.firebaseapp.com",
    projectId: "thithi-3e545",
    storageBucket: "thithi-3e545.firebasestorage.app",
    messagingSenderId: "106233747074",
    appId: "1:106233747074:web:7a5ec1f02fb0728c75469b",
    measurementId: "G-J8TJTMVSR0"
  },
  // ⚠️ QUAN TRỌNG: Cập nhật URL Firebase Function của bạn
  // Format: https://REGION-PROJECT_ID.cloudfunctions.net/FUNCTION_NAME
  // Ví dụ: https://us-central1-thithi-3e545.cloudfunctions.net/chatFunction
  // Xem file HUONG_DAN_CAU_HINH_FUNCTION.md để biết chi tiết
  firebaseFunctionUrl: "https://chatfunction-7wmcfqhioa-uc.a.run.app", // Firebase Function v2 URL
  // Gemini API Key - Lấy từ https://makersuite.google.com/app/apikey
  geminiApiKey: "", // Thêm API key của bạn vào đây
  
  // Microsoft Outlook Integration
  // Lấy từ Azure AD App Registration: https://portal.azure.com
  microsoftClientId: "4e8cf90e-655d-4795-9e6d-4bd4353616f3", // Application (client) ID
  // Tenant ID: "common" = hỗ trợ multi-tenant (bất kỳ Microsoft account nào)
  // Hoặc dùng specific tenant ID nếu chỉ muốn 1 tenant: "1c94e0b1-63e3-405f-a00a-54f8138b0811"
  microsoftTenantId: "common" // "common" = multi-tenant, hoặc specific tenant ID
};

