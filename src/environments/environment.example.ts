/**
 * File mẫu cho environment configuration
 * 
 * HƯỚNG DẪN:
 * 1. Copy file này thành environment.ts và environment.prod.ts
 * 2. Điền các giá trị thực tế vào các placeholder
 * 3. KHÔNG commit file environment.ts và environment.prod.ts có chứa API keys thực tế
 * 4. File này có thể commit vì chỉ chứa placeholder
 */

export const environment = {
  production: false, // true cho environment.prod.ts
  firebaseConfig: {
    // Firebase Config - Lấy từ Firebase Console
    // https://console.firebase.google.com/project/YOUR_PROJECT/settings/general
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  },
  // Firebase Function URL
  // Format: https://REGION-PROJECT_ID.cloudfunctions.net/FUNCTION_NAME
  // Hoặc: https://FUNCTION_NAME-REGION-PROJECT_ID.a.run.app (v2)
  firebaseFunctionUrl: "YOUR_FIREBASE_FUNCTION_URL",
  
  // Gemini API Key - Lấy từ https://makersuite.google.com/app/apikey
  // ⚠️ QUAN TRỌNG: Không hardcode API key ở đây!
  // Sử dụng Firebase Secrets hoặc environment variables
  geminiApiKey: "", // Để trống, sử dụng Firebase Secrets thay thế
  
  // Microsoft Outlook Integration
  // Lấy từ Azure AD App Registration: https://portal.azure.com
  microsoftClientId: "YOUR_MICROSOFT_CLIENT_ID", // Application (client) ID
  microsoftTenantId: "common" // "common" = multi-tenant, hoặc specific tenant ID
};
