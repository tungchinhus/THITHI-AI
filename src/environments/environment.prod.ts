export const environment = {
  production: true,
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
  geminiApiKey: "" // Thêm API key của bạn vào đây
};

