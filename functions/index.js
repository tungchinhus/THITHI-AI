const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {Client} = require("@microsoft/microsoft-graph-client");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");
const admin = require("firebase-admin");
const crypto = require("crypto");

// SQL Server integration (optional - only if SQL_SERVER_HOST is configured)
let sqlConnection = null;
let sqlTSMayService = null;
let sqlChatMemoryService = null;
try {
  sqlConnection = require('./sql-connection');
  sqlTSMayService = require('./sql-tsmay-service');
  sqlChatMemoryService = require('./sql-chat-memory-service');
  console.log('✅ SQL Server modules loaded');
} catch (error) {
  console.warn('⚠️ SQL Server modules not available (optional):', error.message);
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
});

// Cache để lưu model đã tìm được (tránh gọi ListModels mỗi lần)
let cachedModel = null;
let modelCacheTime = 0;
const MODEL_CACHE_DURATION = 3600000; // 1 giờ

// Force sử dụng model miễn phí (gemini-1.5-flash) - Set true để luôn dùng model miễn phí
const FORCE_FREE_MODEL = true; // true = luôn dùng model miễn phí, false = tự động chọn
const FORCED_FREE_MODEL = 'gemini-1.5-flash'; // Model miễn phí với quota cao nhất

/**
 * Hàm tạo Prompt gửi Gemini
 * @param {Object} userDoc - Thông tin người dùng (displayName, jobTitle, department, notes)
 * @param {Array} history - Lịch sử chat (array of {role, content})
 * @param {string} context - Context từ tài liệu (email, OneDrive, etc.)
 * @param {string} userQuery - Câu hỏi mới của user
 * @param {string} currentDateTimeStr - Ngày giờ hiện tại
 * @returns {string} Prompt đầy đủ để gửi Gemini
 */
function buildPrompt(userDoc, history, context, userQuery, currentDateTimeStr) {
  // Tạo phần thông tin người dùng
  let userInfoSection = '';
  if (userDoc) {
    const userRoleText = userDoc.role === 'manager' 
      ? 'Sếp/Quản lý' 
      : userDoc.role === 'new_employee' 
      ? 'Nhân viên mới' 
      : 'Nhân viên';
    
    userInfoSection = `
### 1. THÔNG TIN NGƯỜI DÙNG (Để nhớ sâu & Cá nhân hóa)
- Tên: ${userDoc.displayName || 'Không có'}
- Email: ${userDoc.email || 'Không có'}
- Chức vụ: ${userDoc.jobTitle || userRoleText}
- Phòng ban: ${userDoc.department || 'Chưa rõ'}
- Vai trò: ${userRoleText}
- Ghi chú về sở thích: ${userDoc.notes || 'Thích câu trả lời rõ ràng, đầy đủ'}

⚠️ ÁP DỤNG NGUYÊN TẮC "NHỚ SÂU (CÁ NHÂN HÓA)":
${userDoc.role === 'manager' 
  ? '- Nếu là Sếp/Quản lý: Trả lời súc tích, tập trung vào kết quả, chi phí, hiệu quả.'
  : userDoc.role === 'new_employee'
  ? '- Nếu là Nhân viên mới: Giải thích chi tiết, tận tình từng bước, dễ hiểu.'
  : '- Nếu là Nhân viên: Trả lời rõ ràng, đầy đủ thông tin cần thiết.'}
`;
  } else {
    userInfoSection = `
### 1. THÔNG TIN NGƯỜI DÙNG (Để nhớ sâu & Cá nhân hóa)
- Không có thông tin người dùng
`;
  }

  // Tạo phần context
  let contextSection = '';
  if (context && context.trim()) {
    contextSection = `
### 2. CONTEXT (Tài liệu tham khảo từ OneDrive/Email/Database)
${context}
`;
  } else {
    contextSection = `
### 2. CONTEXT (Tài liệu tham khảo)
- Không có tài liệu tham khảo
`;
  }

  // Tạo phần lịch sử chat
  let historySection = '';
  
  if (history && Array.isArray(history) && history.length > 0) {
    const historyText = history.map((msg, index) => {
      const role = msg.role === 'user' ? 'Người dùng' : 'Trợ lý AI';
      return `${index + 1}. [${role}]: ${msg.content || ''}`;
    }).join('\n');
    
    // Tóm tắt thông tin quan trọng từ lịch sử chat (tên, sở thích, yêu cầu đặc biệt)
    let importantInfoSummary = '';
    const userMessages = history.filter(msg => msg.role === 'user').map(msg => msg.content || '').join(' ');
    
    // Tìm tên người dùng
    const namePatterns = [
      /(?:tên|name|tôi là|i am|i'm|my name is)\s+(?:tôi|i|my name is)?\s*[:\-]?\s*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/i,
      /(?:tôi tên|my name|tên của tôi|tên mình)\s+[:\-]?\s*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/i
    ];
    
    let extractedName = null;
    for (const pattern of namePatterns) {
      const match = userMessages.match(pattern);
      if (match && match[1]) {
        extractedName = match[1].trim();
        break;
      }
    }
    
    if (extractedName) {
      importantInfoSummary += `- Tên người dùng: ${extractedName}\n`;
    }
    
    // Tìm sở thích, yêu cầu đặc biệt
    const preferencePatterns = [
      /(?:thích|like|prefer|muốn|want|yêu cầu|requirement)\s+([^.!?]+)/gi,
      /(?:không thích|don't like|dislike|không muốn|don't want)\s+([^.!?]+)/gi
    ];
    
    const preferences = [];
    for (const pattern of preferencePatterns) {
      const matches = userMessages.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 3) {
          preferences.push(match[1].trim());
        }
      }
    }
    
    if (preferences.length > 0) {
      importantInfoSummary += `- Sở thích/Yêu cầu: ${preferences.slice(0, 3).join(', ')}\n`;
    }
    
    if (importantInfoSummary) {
      importantInfoSummary = `\n📌 TÓM TẮT THÔNG TIN QUAN TRỌNG TỪ LỊCH SỬ CHAT:\n${importantInfoSummary}\n`;
    }
    
    historySection = `
### 3. LỊCH SỬ CHAT (Để hiểu ngữ cảnh "cái đó", "file vừa rồi", "nó")
${importantInfoSummary}${historyText}

🚨🚨🚨 NGUYÊN TẮC "NHỚ SÂU" - CỰC KỲ QUAN TRỌNG:
1. **NHỚ TẤT CẢ THÔNG TIN QUAN TRỌNG:**
   - Tên người dùng: Nếu đã được cung cấp trong lịch sử chat, BẮT BUỘC phải sử dụng tên đó trong mọi câu trả lời tiếp theo.
   - Sở thích, yêu cầu: Nếu người dùng đã nói về sở thích, yêu cầu đặc biệt, PHẢI nhớ và áp dụng.
   - Thông tin cá nhân: Bất kỳ thông tin nào người dùng đã chia sẻ (công việc, dự án, mối quan tâm), PHẢI nhớ.

2. **HIỂU NGỮ CẢNH SÂU:**
   - Khi user hỏi "nó", "cái đó", "như vậy", "điều đó", "tôi", "bạn", hoặc các đại từ khác, BẮT BUỘC phải nhìn LỊCH SỬ CHAT ở trên để biết đang nói cái gì.
   - KHÔNG BAO GIỜ hỏi lại thông tin đã được cung cấp trước đó trong lịch sử chat.
   - Luôn tham khảo lịch sử chat để trả lời chính xác và có ngữ cảnh.

3. **VÍ DỤ CỤ THỂ:**
   - Nếu trong lịch sử có "Tên tôi là CHINH" → Khi user hỏi "Tôi tên gì?", PHẢI trả lời "Tên bạn là CHINH" (KHÔNG được nói "Tôi không biết").
   - Nếu trong lịch sử có "Tôi làm ở phòng IT" → Khi user hỏi "Tôi làm ở đâu?", PHẢI trả lời "Bạn làm ở phòng IT".
   - Nếu trong lịch sử có "Tôi đang làm dự án X" → Khi user hỏi "Dự án của tôi thế nào?", PHẢI nhớ và trả lời về dự án X.

4. **KHÔNG ĐƯỢC QUÊN:**
   - Mọi thông tin trong lịch sử chat đều quan trọng và phải được sử dụng khi cần thiết.
   - Nếu không chắc chắn về thông tin, hãy tìm lại trong LỊCH SỬ CHAT ở trên trước khi trả lời.
`;
  } else {
    historySection = `
### 3. LỊCH SỬ CHAT (Để hiểu ngữ cảnh)
- Không có lịch sử chat trước đó
`;
  }

  // Tạo prompt đầy đủ
  const fullPrompt = `${SYSTEM_INSTRUCTION}

⚠️ QUAN TRỌNG VỀ THỜI GIAN:
- Ngày giờ hiện tại (theo múi giờ Việt Nam): ${currentDateTimeStr}
- Khi người dùng hỏi về "hôm nay", "ngày hôm nay", "hôm nay là ngày mấy", hoặc các câu hỏi tương tự về ngày hiện tại, bạn PHẢI sử dụng thông tin ngày giờ hiện tại ở trên.
- KHÔNG được sử dụng thông tin ngày từ training data hoặc dữ liệu cũ.

--- DỮ LIỆU ĐẦU VÀO CHO PHIÊN LÀM VIỆC ---
${userInfoSection}
${contextSection}
${historySection}

### 4. CÂU HỎI MỚI CỦA USER
"${userQuery}"

--- YÊU CẦU ---
Hãy xử lý và trả về JSON theo đúng định dạng đã quy định trong System Instruction.

⚠️⚠️⚠️ QUAN TRỌNG VỀ ĐỊNH DẠNG JSON:
Bạn PHẢI trả về MỘT JSON object duy nhất với cấu trúc chính xác như sau (KHÔNG có text nào khác trước/sau JSON):

{
  "analysis": "Phân tích ngắn gọn ý định người dùng và ngữ cảnh (ví dụ: User là Kế toán trưởng, cần thông tin chính xác về định mức. 'SG' là TP. Hồ Chí Minh.)",
  "answer": "Câu trả lời chi tiết cho người dùng (Sử dụng Markdown: **in đậm**, list, table...). Ví dụ: Đối với cấp quản lý, hạn mức công tác phí tại **TP. Hồ Chí Minh** hiện tại là **2.500.000 VNĐ/ngày**.",
  "citations": ["Tên file 1", "Tên file 2"],
  "suggestions": [
    "Gợi ý hành động 1 (ngắn gọn dưới 10 từ)",
    "Gợi ý hành động 2",
    "Gợi ý hành động 3"
  ]
}

VÍ DỤ JSON ĐÚNG:
{
  "analysis": "User là Kế toán trưởng, cần thông tin chính xác về định mức. 'SG' là TP. Hồ Chí Minh.",
  "answer": "Đối với cấp quản lý, hạn mức công tác phí tại **TP. Hồ Chí Minh** hiện tại là **2.500.000 VNĐ/ngày** (bao gồm phòng nghỉ và phụ cấp lưu trú).\\n\\nChi tiết xem tại bảng 3.1 quy định tài chính.",
  "citations": ["Quy_dinh_cong_tac_phi_2024.pdf"],
  "suggestions": [
    "Xem chi tiết bảng định mức các tỉnh khác",
    "Tải mẫu tờ trình công tác phí",
    "Quy định về vé máy bay hạng thương gia"
  ]
}

⚠️ LƯU Ý:
- Field "analysis" phải phân tích ngắn gọn về user role và ngữ cảnh câu hỏi
- Field "answer" phải sử dụng Markdown (**, \\n, list, table)
- Field "citations" phải là array (có thể rỗng [] nếu không có tài liệu)
- Field "suggestions" phải là array với 1-3 gợi ý, mỗi gợi ý ngắn gọn dưới 10 từ
- KHÔNG được trả về text thường, CHỈ trả về JSON object
`;
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      location: 'index.js:160',
      message: 'buildPrompt EXIT',
      data: {
        promptLength: fullPrompt.length,
        hasHistorySection: fullPrompt.includes('LỊCH SỬ CHAT'),
        historySectionIndex: fullPrompt.indexOf('### 3. LỊCH SỬ CHAT'),
        historySectionLength: fullPrompt.match(/### 3\. LỊCH SỬ CHAT[\s\S]*?(?=###|$)/)?.[0]?.length || 0,
        promptPreview: fullPrompt.substring(0, 1000)
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'D'
    })
  }).catch(() => {});
  // #endregion
  
  return fullPrompt;
}

// System Instruction cho AI Assistant
const SYSTEM_INSTRUCTION = `
Bạn là Trợ lý AI Thông minh nội bộ.
Nhiệm vụ: Trả lời câu hỏi của nhân viên dựa trên tài liệu được cung cấp.

YÊU CẦU BẮT BUỘC VỀ ĐỊNH DẠNG (JSON):
Bạn KHÔNG được trả lời bằng văn bản thường. Bạn PHẢI trả về một JSON object duy nhất với cấu trúc sau:
{
  "analysis": "Phân tích ngắn gọn ý định người dùng và ngữ cảnh (để debug)",
  "answer": "Câu trả lời chi tiết cho người dùng (Sử dụng Markdown để format: in đậm, list, table...)",
  "citations": ["Tên file 1", "Tên file 2"],
  "suggestions": [
    "Gợi ý hành động 1 (ngắn gọn dưới 10 từ)",
    "Gợi ý hành động 2",
    "Gợi ý hành động 3"
  ]
}

NGUYÊN TẮC "THÔNG MINH":
1. **NHỚ SÂU (Ưu tiên cao nhất):** 
   - PHẢI nhớ TẤT CẢ thông tin quan trọng từ LỊCH SỬ CHAT: tên, sở thích, yêu cầu, công việc, dự án, mối quan tâm.
   - Sử dụng thông tin đã nhớ trong mọi câu trả lời tiếp theo. KHÔNG BAO GIỜ hỏi lại thông tin đã được cung cấp.
   - Nếu user hỏi về thông tin đã được chia sẻ trước đó, PHẢI tìm trong LỊCH SỬ CHAT và trả lời chính xác.

2. **Hiểu ngữ cảnh sâu:** 
   - Nếu user hỏi "nó", "cái đó", "như vậy", "điều đó", "tôi", "bạn", hoặc các đại từ khác, BẮT BUỘC phải nhìn LỊCH SỬ CHAT để biết đang nói cái gì.
   - Luôn tham khảo lịch sử chat để trả lời chính xác và có ngữ cảnh.

3. **Nhớ sâu (Cá nhân hóa):** 
   - Dựa vào "THÔNG TIN NGƯỜI DÙNG" và "LỊCH SỬ CHAT" để điều chỉnh giọng điệu và nội dung.
   - Nếu là Sếp/Quản lý: Trả lời súc tích, tập trung vào kết quả, chi phí.
   - Nếu là Nhân viên mới: Giải thích chi tiết, tận tình từng bước.
   - Sử dụng tên người dùng nếu đã biết từ lịch sử chat.

4. **Gợi ý chủ động:** 
   - Luôn đoán xem user muốn làm gì tiếp theo dựa trên lịch sử chat và ngữ cảnh.
   - Ví dụ: Hỏi về "quy trình công tác" -> Gợi ý "Tải mẫu đơn công tác".

5. **Trung thực:** 
   - Chỉ trả lời dựa trên CONTEXT và LỊCH SỬ CHAT. Không bịa đặt.
   - Nếu không biết, hãy nói rõ và đề xuất cách tìm hiểu thêm.

6. **Xử lý dữ liệu TSMay thông minh:**
   - Khi có dữ liệu TSMay trong CONTEXT, PHẢI sử dụng dữ liệu đó để trả lời chính xác.
   - Hiểu rõ các field quan trọng: kVA (công suất), Soá maùy/Số máy (số máy), LSX, SBB, TBKT (mã), Kieåu maùy/Kiểu máy (kiểu máy), Ngaøy XX/Ngày XX (ngày), v.v.
   - Khi user hỏi "xem chi tiết" hoặc "hiển thị đầy đủ", PHẢI liệt kê TẤT CẢ các field có trong dữ liệu tìm được, không chỉ một vài field.
   - Format dữ liệu rõ ràng: sử dụng bảng, danh sách có dấu đầu dòng, hoặc format markdown để dễ đọc.
   - Nếu tìm thấy nhiều bản ghi, hãy tóm tắt và so sánh các điểm chính.
   - Khi user hỏi về một mã cụ thể (ví dụ: "24142TJ"), PHẢI tìm trong dữ liệu và hiển thị TẤT CẢ thông tin liên quan đến mã đó.
   - **TÍNH TOÁN THỐNG KÊ:** Khi user yêu cầu tính toán thống kê (độ lệch chuẩn, trung bình, trung vị, phương sai, min, max, tổng), hệ thống đã tự động tính toán và cung cấp kết quả trong CONTEXT. Bạn PHẢI sử dụng kết quả tính toán đó để trả lời trực tiếp cho user, KHÔNG được nói rằng bạn không thể tính toán.

⚠️ QUAN TRỌNG VỀ ĐỊNH DẠNG JSON:
- Bạn PHẢI trả về JSON object, KHÔNG được trả về văn bản thường.
- JSON phải có đầy đủ 4 fields: analysis, answer, citations, suggestions.
- Field "citations" phải là array (có thể rỗng [] nếu không có tài liệu tham khảo).
- Field "suggestions" phải là array với ít nhất 1-3 gợi ý (mỗi gợi ý ngắn gọn dưới 10 từ).
- Field "answer" phải sử dụng Markdown để format (in đậm, list, table, v.v.).
`;

/**
 * Chat Function - Xử lý câu hỏi từ người dùng
 * 
 * Request body:
 * {
 *   "question": "Câu hỏi của người dùng"
 * }
 * 
 * Response:
 * {
 *   "answer": "Câu trả lời từ AI",
 *   "sources": ["file1.pdf", "file2.pdf"]
 * }
 */
exports.chatFunction = onRequest(
  {
    cors: true, // Enable CORS
    maxInstances: 10,
    secrets: [
      "GEMINI_API_KEY",
      "MICROSOFT_CLIENT_SECRET", // For future refresh token implementation
      // SQL Server secrets for chat memory
      // Note: SQL_SERVER_USER and SQL_SERVER_PASSWORD are optional
      // If not provided, Windows Authentication (Integrated Security) will be used
      "SQL_SERVER_HOST",
      "SQL_SERVER_USER", // Optional - omit for Windows Authentication
      "SQL_SERVER_PASSWORD", // Optional - omit for Windows Authentication
      "SQL_SERVER_DATABASE",
      "SQL_SERVER_PORT" // Optional
      // Note: MICROSOFT_TENANT_ID removed - not needed in backend, already in frontend environment.ts
    ],
  },
  async (req, res) => {
    // Handle CORS preflight
    cors(req, res, async () => {
      try {
        // Only allow POST requests
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method Not Allowed",
            message: "Only POST method is allowed",
          });
        }

      // Get question, Microsoft access token, chat history, and user info from request body
      const {question, microsoftAccessToken, chatHistory, userInfo} = req.body;
      
      // Initialize SQL Server connection pool if available
      let sqlPoolInitialized = false;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:368',message:'Checking SQL Server config',data:{hasSqlConnection:!!sqlConnection,hasSqlHost:!!process.env.SQL_SERVER_HOST,hasSqlUser:!!process.env.SQL_SERVER_USER,hasSqlPassword:!!process.env.SQL_SERVER_PASSWORD,hasSqlDatabase:!!process.env.SQL_SERVER_DATABASE},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      const useWindowsAuth = !process.env.SQL_SERVER_USER && !process.env.SQL_SERVER_PASSWORD;
      console.log('🔍 DEBUG: SQL Server config check', {
        hasSqlConnection: !!sqlConnection,
        hasSqlHost: !!process.env.SQL_SERVER_HOST,
        authentication: useWindowsAuth ? 'Windows Authentication' : 'SQL Server Authentication',
        hasSqlUser: !!process.env.SQL_SERVER_USER,
        hasSqlPassword: !!process.env.SQL_SERVER_PASSWORD,
        hasSqlDatabase: !!process.env.SQL_SERVER_DATABASE
      });
      // #endregion
      if (sqlConnection && process.env.SQL_SERVER_HOST) {
        try {
          const pool = sqlConnection.getSQLPool();
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:371',message:'Pool status before init',data:{poolExists:!!pool,poolConnected:pool?.connected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          if (!pool || !pool.connected) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:373',message:'Initializing SQL pool',data:{server:process.env.SQL_SERVER_HOST,database:process.env.SQL_SERVER_DATABASE||'THITHI_AI',port:parseInt(process.env.SQL_SERVER_PORT||'1433')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            // Build config object - omit user/password for Windows Authentication
            const sqlConfig = {
              server: process.env.SQL_SERVER_HOST,
              database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI',
              port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
              encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false'
            };
            
            // Only add user/password if provided (for SQL Server Authentication)
            // If omitted, Windows Authentication will be used
            if (process.env.SQL_SERVER_USER) {
              sqlConfig.user = process.env.SQL_SERVER_USER;
            }
            if (process.env.SQL_SERVER_PASSWORD) {
              sqlConfig.password = process.env.SQL_SERVER_PASSWORD;
            }
            
            await sqlConnection.initializeSQLPool(sqlConfig);
            sqlPoolInitialized = true;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:380',message:'Pool initialized successfully',data:{sqlPoolInitialized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            console.log('✅ SQL Server connection pool initialized for chat memory');
          } else {
            sqlPoolInitialized = true;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:383',message:'Pool already connected',data:{sqlPoolInitialized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
          }
        } catch (sqlError) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:385',message:'Pool init failed',data:{error:sqlError.message,code:sqlError.code,name:sqlError.name,stack:sqlError.stack?.substring(0,300),sqlPoolInitialized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          console.warn('⚠️ Failed to initialize SQL Server connection pool:', sqlError.message);
          console.warn('   Error code:', sqlError.code);
          console.warn('   Error name:', sqlError.name);
          console.warn('   Server:', process.env.SQL_SERVER_HOST);
          console.warn('   Note: If using localhost, SQL Server must be accessible from Firebase Functions (cloud).');
          console.warn('   Consider using Azure SQL Database or a public IP address.');
          sqlPoolInitialized = false;
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:388',message:'SQL Server not configured',data:{hasSqlConnection:!!sqlConnection,hasSqlHost:!!process.env.SQL_SERVER_HOST},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
      
      // Initialize chat memory service if SQL Server is available
      let chatSessionId = null;
      const userId = userInfo?.email || userInfo?.uid || 'anonymous';
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:393',message:'Initializing chat memory service',data:{hasService:!!sqlChatMemoryService,sqlPoolInitialized,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (sqlChatMemoryService && sqlPoolInitialized) {
        try {
          // Initialize embedding function for chat memory
          sqlChatMemoryService.initializeEmbeddingFunctions(generateEmbedding);
          
          // Get or create chat session
          const sessionTitle = question.substring(0, 100); // Use first 100 chars as title
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:400',message:'Creating chat session',data:{userId,sessionTitle:sessionTitle.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          chatSessionId = await sqlChatMemoryService.upsertChatSession(userId, sessionTitle);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:402',message:'Session created',data:{chatSessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.log('✅ Chat session initialized:', chatSessionId);
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:404',message:'Session creation failed',data:{error:error.message,stack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.warn('⚠️ Failed to initialize chat memory service:', error.message);
          console.warn('   Error details:', error.stack?.substring(0, 200));
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:409',message:'Chat memory service not available',data:{hasService:!!sqlChatMemoryService,sqlPoolInitialized,hasHost:!!process.env.SQL_SERVER_HOST},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log('ℹ️ Chat memory service not available:', {
          hasService: !!sqlChatMemoryService,
          sqlPoolInitialized,
          hasHost: !!process.env.SQL_SERVER_HOST
        });
      }

      // Validate question
      if (!question || typeof question !== "string" || question.trim() === "") {
        return res.status(400).json({
          error: "Bad Request",
          message: "Question is required and must be a non-empty string",
        });
      }

      // ============================================
      // Xử lý câu hỏi về email Outlook (PHẢI làm TRƯỚC khi tạo prompt)
      // ============================================
      let emailContext = '';
      // #region agent log
      const isEmailQuestion = isEmailRelatedQuestion(question);
      console.log('📧 Email question check:', {
        question: question.substring(0, 50),
        isEmailQuestion,
        hasToken: !!microsoftAccessToken
      });
      // #endregion
      if (microsoftAccessToken && isEmailQuestion) {
        try {
          // #region agent log
          console.log('📧 Calling searchOutlookEmails...', {
            question: question.substring(0, 50),
            tokenLength: microsoftAccessToken.length
          });
          // #endregion
          emailContext = await searchOutlookEmails(question, microsoftAccessToken);
          // #region agent log
          console.log('📧 searchOutlookEmails result:', {
            hasEmailContext: !!emailContext,
            emailContextLength: emailContext?.length || 0,
            emailContextPreview: emailContext?.substring(0, 100) || 'null'
          });
          // #endregion
          if (emailContext) {
            console.log('📧 Found email context:', emailContext.substring(0, 200));
          }
        } catch (emailError) {
          // #region agent log
          console.error('❌ Error searching emails:', {
            error: emailError.message,
            errorStack: emailError.stack?.substring(0, 200)
          });
          // #endregion
          
          // If email search fails, set emailContext to error message
          // This will be included in the prompt so AI can inform user
          const errorMsg = emailError.message || 'Unknown error';
          if (errorMsg.includes('external user') || errorMsg.includes('Gmail') || errorMsg.includes('Google account')) {
            emailContext = `Lỗi: Người dùng là external user (Gmail/Google account) và không có Exchange mailbox. Microsoft Graph API chỉ hỗ trợ Microsoft 365 mailboxes. Vui lòng đăng nhập bằng Microsoft 365 account hoặc Outlook.com account.`;
          } else if (errorMsg.includes('inactive') || 
              errorMsg.includes('soft-deleted') ||
              errorMsg.includes('on-premise') ||
              errorMsg.includes('MailboxNotEnabledForRESTAPI')) {
            emailContext = `Lỗi: Mailbox không khả dụng cho REST API. Có thể do:\n` +
              `1. Mailbox là on-premise Exchange (không hỗ trợ Graph API)\n` +
              `2. Mailbox chưa được kích hoạt cho REST API\n` +
              `3. Người dùng không có Microsoft 365 license\n` +
              `4. Mailbox bị soft-deleted hoặc inactive\n\n` +
              `Chi tiết lỗi: ${errorMsg}`;
          } else {
            emailContext = `Lỗi khi tìm kiếm email: ${errorMsg}`;
          }
        }
      } else {
        // #region agent log
        console.log('⚠️ Skipping email search:', {
          hasToken: !!microsoftAccessToken,
          isEmailQuestion,
          reason: !microsoftAccessToken ? 'No token' : 'Not email question'
        });
        // #endregion
      }
      
      // ============================================
      // Xử lý câu hỏi về OneDrive (PHẢI làm TRƯỚC khi tạo prompt)
      // ============================================
      let oneDriveContext = '';
      // #region agent log
      const isOneDriveQuestion = isOneDriveRelatedQuestion(question);
      // Also check if question is about files/documents when Microsoft token is available
      // This makes AI smarter to understand file-related questions even without "onedrive" keyword
      const isFileRelatedQuestion = isFileRelatedQuestionSmart(question);
      const shouldSearchOneDrive = isOneDriveQuestion || (microsoftAccessToken && isFileRelatedQuestion);
      console.log('📁 OneDrive question check:', {
        question: question.substring(0, 50),
        isOneDriveQuestion,
        isFileRelatedQuestion,
        shouldSearchOneDrive,
        hasToken: !!microsoftAccessToken
      });
      // #endregion
      if (microsoftAccessToken && shouldSearchOneDrive) {
        try {
          // #region agent log
          console.log('📁 Calling searchOneDriveFiles...', {
            question: question.substring(0, 50),
            tokenLength: microsoftAccessToken.length
          });
          // #endregion
          oneDriveContext = await searchOneDriveFiles(question, microsoftAccessToken);
          // #region agent log
          console.log('📁 searchOneDriveFiles result:', {
            hasOneDriveContext: !!oneDriveContext,
            oneDriveContextLength: oneDriveContext?.length || 0,
            oneDriveContextPreview: oneDriveContext?.substring(0, 100) || 'null'
          });
          // #endregion
          if (oneDriveContext) {
            console.log('📁 Found OneDrive context:', oneDriveContext.substring(0, 200));
          }
        } catch (oneDriveError) {
          // #region agent log
          console.error('❌ Error searching OneDrive:', {
            error: oneDriveError.message,
            errorStack: oneDriveError.stack?.substring(0, 200)
          });
          // #endregion
          
          // If OneDrive search fails, set oneDriveContext to error message
          const errorMsg = oneDriveError.message || 'Unknown error';
          oneDriveContext = `Lỗi khi tìm kiếm OneDrive: ${errorMsg}`;
        }
      } else {
        // #region agent log
        console.log('⚠️ Skipping OneDrive search:', {
          hasToken: !!microsoftAccessToken,
          isOneDriveQuestion,
          isFileRelatedQuestion,
          shouldSearchOneDrive,
          reason: !microsoftAccessToken ? 'No token' : 'Not file/OneDrive question'
        });
        // #endregion
      }
      
      // ============================================
      // Xử lý câu hỏi về TSMay (Firestore collection)
      // ============================================
      let tsMayContext = '';
      // #region agent log
      const isTSMayQuestion = isTSMayRelatedQuestion(question);
      const isStatisticalCalc = isStatisticalCalculationQuestion(question);
      console.log('📊 TSMay question check:', {
        question: question.substring(0, 50),
        isTSMayQuestion,
        isStatisticalCalc
      });
      // #endregion
      
      // If it's a statistical calculation question, use calculation function
      if (isStatisticalCalc) {
        try {
          // #region agent log
          console.log('📊 Calling calculateTSMayStatistics...', {
            question: question.substring(0, 50)
          });
          // #endregion
          tsMayContext = await calculateTSMayStatistics(question);
          // #region agent log
          console.log('📊 calculateTSMayStatistics result:', {
            hasTSMayContext: !!tsMayContext,
            tsMayContextLength: tsMayContext?.length || 0,
            tsMayContextPreview: tsMayContext?.substring(0, 100) || 'null'
          });
          // #endregion
          if (tsMayContext) {
            console.log('📊 Found TSMay calculation result:', tsMayContext.substring(0, 200));
          }
        } catch (calcError) {
          // #region agent log
          console.error('❌ Error calculating TSMay statistics:', {
            error: calcError.message,
            errorStack: calcError.stack?.substring(0, 500)
          });
          // #endregion
          
          // If calculation fails, set tsMayContext to detailed error message for AI
          const errorMsg = calcError.message || 'Unknown error';
          tsMayContext = `**LỖI KHI TÍNH TOÁN THỐNG KÊ:**
          
Hệ thống đã cố gắng tính toán thống kê từ dữ liệu TSMay nhưng gặp lỗi: ${errorMsg}

**Nguyên nhân có thể:**
- Dữ liệu TSMay chưa được import hoặc collection trống
- Field được yêu cầu không tồn tại trong dữ liệu
- Dữ liệu không có giá trị số hợp lệ để tính toán
- Lỗi kết nối với Firestore

**Hướng dẫn cho AI:** Hãy thông báo lỗi này cho người dùng một cách rõ ràng và đề xuất các giải pháp thay thế như sử dụng Excel hoặc kiểm tra lại dữ liệu TSMay.`;
        }
      } else if (isTSMayQuestion) {
        try {
          // #region agent log
          console.log('📊 Calling searchTSMayData...', {
            question: question.substring(0, 50)
          });
          // #endregion
          tsMayContext = await searchTSMayData(question);
          // #region agent log
          console.log('📊 searchTSMayData result:', {
            hasTSMayContext: !!tsMayContext,
            tsMayContextLength: tsMayContext?.length || 0,
            tsMayContextPreview: tsMayContext?.substring(0, 100) || 'null'
          });
          // #endregion
          if (tsMayContext) {
            console.log('📊 Found TSMay context:', tsMayContext.substring(0, 200));
          }
        } catch (tsMayError) {
          // #region agent log
          console.error('❌ Error searching TSMay:', {
            error: tsMayError.message,
            errorStack: tsMayError.stack?.substring(0, 200)
          });
          // #endregion
          
          // If TSMay search fails, set tsMayContext to error message
          const errorMsg = tsMayError.message || 'Unknown error';
          tsMayContext = `Lỗi khi tìm kiếm dữ liệu TSMay: ${errorMsg}`;
        }
      } else {
        // #region agent log
        console.log('⚠️ Skipping TSMay search:', {
          isTSMayQuestion,
          isStatisticalCalc,
          reason: 'Not TSMay question or calculation'
        });
        // #endregion
      }
      
      // ============================================
      // Xử lý AI chat với Google Gemini
      // ============================================
      
      let answer = "";
      let sources = [];
      let analysis = "";
      let suggestions = [];
      
      try {
        // Lấy API key từ secret
        // Trong Firebase Functions v2, secret được inject vào process.env
        const geminiApiKey = process.env.GEMINI_API_KEY;
        
        if (geminiApiKey) {
          try {
            // Sử dụng cached model nếu có và chưa hết hạn
            let selectedModel = cachedModel;
            const now = Date.now();
            
            if (!selectedModel || (now - modelCacheTime) > MODEL_CACHE_DURATION) {
              // LUÔN gọi ListModels để kiểm tra model có sẵn (không force model nếu không có)
              const listModelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${geminiApiKey}`;
              const listResponse = await fetch(listModelsUrl);
              
              if (listResponse.ok) {
                const listData = await listResponse.json();
                  
                  // Ưu tiên các model MIỄN PHÍ với quota cao nhất:
                // 1. gemini-1.5-flash (MIỄN PHÍ, quota cao nhất) - ƯU TIÊN HÀNG ĐẦU
                // 2. gemini-1.5-pro (MIỄN PHÍ, mạnh hơn)
                // 3. gemini-*-flash-lite (Lite versions thường có free tier tốt hơn)
                // 4. gemini-flash (older version)
                // LƯU Ý: gemini-2.0-flash và 2.5-flash thường KHÔNG có free tier (limit: 0)
                // Nên ưu tiên "lite" versions hoặc 1.5 models
                const preferredModelNames = [
                  'gemini-1.5-flash',      // ƯU TIÊN #1: Model miễn phí với quota cao nhất
                  'gemini-1.5-pro',       // ƯU TIÊN #2: Model miễn phí mạnh hơn
                  'gemini-2.0-flash-lite', // ƯU TIÊN #3: Lite version có thể có free tier
                  'gemini-2.5-flash-lite', // ƯU TIÊN #4: Lite version có thể có free tier
                  'gemini-2.0-flash-lite-001', // Variant của lite
                  'gemini-flash',         // Fallback (older version)
                  'gemini-pro',           // Fallback (older version)
                  'gemini-2.0-flash-exp', // Experimental
                  'gemini-2.0-flash-001', // Variant
                  'gemini-2.0-flash',     // CUỐI CÙNG: Thường không có free tier
                  'gemini-2.5-flash',     // CUỐI CÙNG: Thường không có free tier
                  'gemini-2.5-pro'        // CUỐI CÙNG: Thường không có free tier
                ];
                
                let foundModel = null;
                const availableModels = [];
                
                // Thu thập tất cả model có sẵn
                for (const model of listData.models || []) {
                  const modelName = model.name?.replace('models/', '') || model.name;
                  const supportsGenerateContent = model.supportedGenerationMethods?.includes('generateContent');
                  
                  if (supportsGenerateContent && modelName) {
                    availableModels.push(modelName);
                  }
                }
                
                // Log available models for debugging
                console.log(`📋 Available models (${availableModels.length}):`, availableModels.join(', '));
                
                // Tìm model theo thứ tự ưu tiên (exact match trước, sau đó partial match)
                for (const preferredName of preferredModelNames) {
                  // Ưu tiên exact match trước
                  foundModel = availableModels.find(name => 
                    name.toLowerCase() === preferredName.toLowerCase()
                  );
                  
                  // Nếu không có exact match, thử partial match
                  if (!foundModel) {
                    foundModel = availableModels.find(name => 
                      name.toLowerCase().includes(preferredName.toLowerCase())
                    );
                  }
                  
                  if (foundModel) {
                    console.log(`✅ Found preferred model: ${foundModel} (matched: ${preferredName})`);
                    break;
                  }
                }
                
                // Nếu không tìm thấy model ưu tiên, chọn model miễn phí
                if (!foundModel && availableModels.length > 0) {
                  // Ưu tiên model có "1.5-flash" (model miễn phí tốt nhất)
                  foundModel = availableModels.find(name => 
                    name.toLowerCase().includes('1.5-flash')
                  );
                  
                  // Nếu không có 1.5-flash, tìm model có "flash" (thường là miễn phí)
                  if (!foundModel) {
                    foundModel = availableModels.find(name => 
                      name.toLowerCase().includes('flash')
                    );
                  }
                  
                  // Cuối cùng mới chọn model có "pro" hoặc model đầu tiên
                  if (!foundModel) {
                    foundModel = availableModels.find(name => 
                      name.toLowerCase().includes('pro')
                    ) || availableModels[0];
                  }
                }
                
                if (foundModel) {
                  selectedModel = foundModel;
                  cachedModel = selectedModel;
                  modelCacheTime = now;
                  
                  // Kiểm tra xem model có phải là model miễn phí không
                  const isFreeModel = selectedModel.toLowerCase().includes('1.5-flash') || 
                                     selectedModel.toLowerCase().includes('1.5-pro');
                  
                  
                  if (isFreeModel) {
                    console.log(`✅ Selected FREE model: ${selectedModel} (from ${availableModels.length} available models) - High quota!`);
                  } else {
                    console.log(`✅ Selected model: ${selectedModel} (from ${availableModels.length} available models)`);
                  }
                } else {
                  console.warn(`⚠️ No preferred model found. Available models: ${availableModels.join(', ')}`);
                  // Nếu không tìm thấy model ưu tiên, chọn model đầu tiên có sẵn
                  if (availableModels.length > 0) {
                    foundModel = availableModels[0];
                    selectedModel = foundModel;
                    cachedModel = selectedModel;
                    modelCacheTime = now;
                    console.log(`⚠️ Using fallback model: ${selectedModel}`);
                  }
                }
              } else {
                // Nếu ListModels API fail, log warning nhưng vẫn thử dùng model mặc định
                console.warn(`⚠️ ListModels API failed: ${listResponse.status}. Will try default model.`);
                // Không set selectedModel ở đây, để code dưới xử lý
              }
            } else {
              console.log(`Using cached model: ${selectedModel}`);
            }
            
            if (selectedModel) {
              // Lấy thông tin ngày giờ hiện tại
              const now = new Date();
              const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
              const day = vietnamTime.getDate();
              const month = vietnamTime.getMonth() + 1; // getMonth() trả về 0-11
              const year = vietnamTime.getFullYear();
              const hours = vietnamTime.getHours();
              const minutes = vietnamTime.getMinutes();
              
              // Tên tháng bằng tiếng Việt
              const monthNames = ["tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6",
                                "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12"];
              const dayNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
              const dayOfWeek = dayNames[vietnamTime.getDay()];
              const monthName = monthNames[month - 1];
              
              const currentDateStr = `${day} ${monthName} năm ${year}`;
              const currentTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              const currentDateTimeStr = `${dayOfWeek}, ngày ${day} ${monthName} năm ${year}, lúc ${currentTimeStr}`;
              
              // Chuẩn bị dữ liệu cho buildPrompt
              // 1. UserDoc - Thông tin người dùng
              const userDoc = userInfo ? {
                displayName: userInfo.displayName || 'Không có',
                email: userInfo.email || 'Không có',
                jobTitle: userInfo.jobTitle || (userInfo.role === 'manager' ? 'Sếp/Quản lý' : userInfo.role === 'new_employee' ? 'Nhân viên mới' : 'Nhân viên'),
                department: userInfo.department || 'Chưa rõ',
                role: userInfo.role || 'employee',
                notes: userInfo.notes || 'Thích câu trả lời rõ ràng, đầy đủ'
              } : null;

              // 2. History - Lịch sử chat (lấy tối đa 50 messages gần nhất để AI nhớ sâu hơn)
              const recentHistory = chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0
                ? chatHistory.slice(-50)
                : [];
              
              // 2a. Search chat memory for deep context (if SQL Server is available)
              let memoryContext = '';
              if (sqlChatMemoryService && sqlPoolInitialized && userInfo) {
                try {
                  const similarMemories = await sqlChatMemoryService.searchChatMemory(userId, question, {
                    similarityThreshold: 0.4,
                    topN: 5,
                    sessionId: chatSessionId
                  });
                  
                  if (similarMemories && similarMemories.length > 0) {
                    memoryContext = `\n### THÔNG TIN TỪ LỊCH SỬ CHAT TRƯỚC ĐÓ (Nhớ sâu):\n`;
                    similarMemories.forEach((memory, index) => {
                      memoryContext += `${index + 1}. [${memory.contentType}] ${memory.content.substring(0, 200)}${memory.content.length > 200 ? '...' : ''} (Similarity: ${(memory.similarity * 100).toFixed(1)}%)\n`;
                    });
                    memoryContext += `\nSử dụng thông tin từ lịch sử chat trên để hiểu ngữ cảnh và trả lời chính xác hơn.\n`;
                    console.log(`✅ Found ${similarMemories.length} relevant memories from chat history`);
                  } else {
                    console.log('ℹ️ No similar memories found in chat history');
                  }
                } catch (memoryError) {
                  console.warn('⚠️ Error searching chat memory:', memoryError.message);
                  console.warn('   Error stack:', memoryError.stack?.substring(0, 200));
                }
              } else {
                // Fallback: Use chatHistory from request for context
                if (recentHistory && recentHistory.length > 0) {
                  console.log('ℹ️ Using chatHistory from request (SQL Server not available)');
                }
              }
              
              if (recentHistory.length > 0) {
                console.log(`✅ Preparing chat history for prompt: ${recentHistory.length} messages`);
              } else {
                console.log('⚠️ No chat history provided');
              }

              // 3. Context - Kết hợp email, OneDrive và TSMay context
              let combinedContext = '';
              if (emailContext) {
                combinedContext += `📧 THÔNG TIN EMAIL TỪ OUTLOOK:\n${emailContext}\n\nKhi người dùng hỏi về email, hãy sử dụng thông tin email ở trên để trả lời. Nếu không tìm thấy email phù hợp, hãy thông báo rõ ràng.\n\n`;
                console.log('✅ Email context prepared for prompt:', emailContext.substring(0, 200));
              }
              
              if (oneDriveContext) {
                combinedContext += `📁 THÔNG TIN TỪ ONEDRIVE:\n${oneDriveContext}\n\nKhi người dùng hỏi về file hoặc tài liệu trong OneDrive, hãy sử dụng thông tin ở trên để trả lời. Nếu cần tóm tắt nội dung file, hãy làm ngắn gọn và thông minh.\n\n`;
                console.log('✅ OneDrive context prepared for prompt:', oneDriveContext.substring(0, 200));
              }
              
              if (tsMayContext) {
                combinedContext += `📊 THÔNG TIN TỪ TSMay (Dữ liệu Excel đã import):\n${tsMayContext}\n\n**HƯỚNG DẪN XỬ LÝ DỮ LIỆU TSMay:**
- Dữ liệu TSMay chứa thông tin về máy biến áp/transformer với các field quan trọng:
  * **kVA**: Công suất máy biến áp
  * **Soá maùy/Số máy**: Số máy/serial number (ví dụ: T00035999, 212320063)
  * **LSX**: Mã LSX (ví dụ: 2081001453, 50000109)
  * **SBB**: Mã SBB (ví dụ: 2130493, 2533132)
  * **TBKT**: Mã TBKT (ví dụ: 24142TJ, 25076D, 20162D)
  * **T.Chuaån LSX**: Tiêu chuẩn LSX (ví dụ: DLVN-62, DLTP-T53/20)
  * **Kieåu maùy/Kiểu máy**: Kiểu máy (ví dụ: ONAN-320-ST-WST-BR-RT)
  * **Po (W)**: Công suất không tải (Watts)
  * **Io (%)**: Dòng điện không tải (%)
  * **Pk75 (W)**: Công suất ngắn mạch ở 75°C (Watts)
  * **Uk75 (%)**: Điện áp ngắn mạch ở 75°C (%)
  * **Uñm HV/Uđm HV**: Điện áp định mức cao áp (thường là 22)
  * **LV**: Điện áp thấp (thường là 0.4)
  * **Ngaøy XX/Ngày XX**: Ngày (format DD/MM/YYYY)
  * **BNC**: Mã BNC (ví dụ: WST, CAP, MR)
  * **Daàu**: Loại dầu (ví dụ: POWEROIL, Supertrans, Nynas-N.Ge)

- Khi người dùng hỏi về dữ liệu TSMay:
  1. PHẢI sử dụng dữ liệu ở trên để trả lời chính xác
  2. Nếu tìm thấy bản ghi, hiển thị ĐẦY ĐỦ tất cả các field, không chỉ một vài field
  3. Format dữ liệu rõ ràng, dễ đọc (sử dụng markdown, bảng, danh sách)
  4. Nếu user hỏi "xem chi tiết" hoặc "hiển thị đầy đủ", PHẢI liệt kê TẤT CẢ các field
  5. So sánh và tóm tắt nếu có nhiều bản ghi
  6. Sử dụng tên field gốc (không dùng tên sanitized như col_3, col_20)

- **TÍNH TOÁN THỐNG KÊ:** Hệ thống có thể tính toán các chỉ số thống kê từ dữ liệu TSMay:
  * Độ lệch chuẩn (standard deviation)
  * Trung bình (mean/average)
  * Trung vị (median)
  * Phương sai (variance)
  * Giá trị nhỏ nhất (min)
  * Giá trị lớn nhất (max)
  * Tổng (sum)
  
  **QUAN TRỌNG - CÁCH XỬ LÝ TÍNH TOÁN THỐNG KÊ:**
  1. Khi user yêu cầu tính toán (ví dụ: "tính độ lệch chuẩn của TBKT 20113B"), hệ thống đã tự động:
     - Phát hiện loại tính toán (độ lệch chuẩn, trung bình, etc.)
     - Phát hiện điều kiện lọc (TBKT = 20113B, LSX = xxx, etc.)
     - Tự động chọn field số phù hợp để tính toán (nếu user không chỉ định field cụ thể)
     - Thực hiện tính toán và cung cấp kết quả trong CONTEXT
  
  2. Bạn PHẢI sử dụng kết quả tính toán trong CONTEXT để trả lời trực tiếp cho user
  
  3. Nếu kết quả tính toán có trong CONTEXT:
     - Hiển thị kết quả một cách rõ ràng và dễ hiểu
     - Giải thích ý nghĩa của kết quả (nếu cần)
     - Nếu có filter (ví dụ: TBKT 20113B), nhắc lại điều kiện lọc trong câu trả lời
  
  4. Nếu kết quả tính toán báo lỗi hoặc không tìm thấy dữ liệu:
     - Giải thích rõ ràng lý do (ví dụ: không tìm thấy dữ liệu với TBKT = 20113B)
     - Đề xuất các giải pháp thay thế (kiểm tra lại mã TBKT, thử tìm kiếm khác, etc.)
     - KHÔNG được nói rằng bạn không thể tính toán nếu hệ thống đã cung cấp kết quả tính toán
  
  5. Khi user hỏi "tính [loại] của [filter]" (ví dụ: "tính độ lệch chuẩn của TBKT 20113B"):
     - Hệ thống sẽ tự động tính toán cho TẤT CẢ các field số trong các record thỏa mãn điều kiện filter
     - Nếu không chỉ định field cụ thể, hệ thống sẽ tự động chọn field số quan trọng nhất (ưu tiên: kVA, Po, Io, Pk75, Uk75, A, G, H, I)
     - Bạn cần hiển thị rõ field nào đã được tính toán

- **PHÂN TÍCH VÀ ĐẾM DỮ LIỆU:** Hệ thống có thể đếm, nhóm và phân tích dữ liệu TSMay:
  * Đếm số lượng bản ghi: "có bao nhiêu", "how many", "tổng số"
  * Đếm số lượng distinct: "có bao nhiêu số máy", "có bao nhiêu LSX khác nhau"
  * Lọc và đếm: "có bao nhiêu số máy trong TBKT 20161D", "có bao nhiêu bản ghi với LSX 2081001453"
  * Nhóm dữ liệu: "nhóm theo TBKT", "thống kê theo LSX"
  Khi user hỏi về số lượng hoặc yêu cầu đếm, hệ thống đã tự động phân tích và cung cấp kết quả trong CONTEXT. Bạn PHẢI sử dụng kết quả đó để trả lời trực tiếp, KHÔNG được nói rằng bạn không thể đếm hoặc không có quyền truy cập.

- Nếu không tìm thấy dữ liệu phù hợp, hãy nói rõ và đề xuất cách tìm kiếm khác.\n\n`;
                console.log('✅ TSMay context prepared for prompt:', tsMayContext.substring(0, 200));
              }

              // Add memory context to combined context
              if (memoryContext) {
                combinedContext = memoryContext + '\n' + combinedContext;
              }
              
              if (!combinedContext && !memoryContext) {
                combinedContext = 'Không có tài liệu tham khảo từ email, OneDrive hoặc TSMay.';
              }

              // 4. UserQuery - Câu hỏi của user
              const userQuery = question;

              // Sử dụng hàm buildPrompt để tạo prompt
              const systemPrompt = buildPrompt(userDoc, recentHistory, combinedContext, userQuery, currentDateTimeStr);
              
              console.log('✅ Prompt built using buildPrompt function');
              if (recentHistory.length > 0) {
                console.log(`   - History included: ${recentHistory.length} messages`);
              }
              
              // Sử dụng v1beta cho các model mới (2.0+, 1.5-flash), v1 cho các model cũ
              // gemini-1.5-flash thường cần v1beta
              let apiVersion = selectedModel.includes('2.0') || 
                              selectedModel.includes('2.5') || 
                              selectedModel.includes('1.5-flash') ||
                              selectedModel.includes('1.5-pro')
                ? 'v1beta' 
                : 'v1';
              
              // Thử gọi API, nếu fail với 404 thì thử version khác
              let response;
              let apiVersionToUse = apiVersion;
              
              for (let attempt = 0; attempt < 2; attempt++) {
                // Gọi generateContent với model đã tìm được
                const apiUrl = `https://generativelanguage.googleapis.com/${apiVersionToUse}/models/${selectedModel}:generateContent?key=${geminiApiKey}`;
                
                // Với v1beta, có thể dùng systemInstruction, với v1 thì đưa vào prompt
                // Lưu ý: buildPrompt đã bao gồm cả question ở cuối, nên với v1beta chỉ cần systemInstruction
                // Với v1, cần append question vào systemPrompt (nhưng buildPrompt đã có sẵn)
                const requestBody = apiVersionToUse === 'v1beta' 
                  ? {
                      contents: [{
                        parts: [{ text: userQuery }]
                      }],
                      systemInstruction: {
                        parts: [{ text: systemPrompt }]
                      }
                    }
                  : {
                      contents: [{
                        parts: [{ text: systemPrompt }]
                      }]
                    };
                
                response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody)
                });
                
                // Nếu thành công, break
                if (response.ok) {
                  break;
                }
                
                // Nếu 404 và đang dùng v1, thử v1beta ở lần thử tiếp theo
                if (response.status === 404 && apiVersionToUse === 'v1' && attempt === 0) {
                  console.log(`⚠️ Model ${selectedModel} not found in v1, trying v1beta...`);
                  apiVersionToUse = 'v1beta';
                  // Tiếp tục vòng lặp để thử v1beta
                } else {
                  // Lỗi khác 404 hoặc đã thử cả 2 version, break
                  break;
                }
              }
                
              if (!response.ok) {
                let errorDetails = '';
                let errorCode = response.status;
                let errorMessage = '';
                
                try {
                  const errorText = await response.text();
                  errorDetails = errorText;
                  
                  // Thử parse JSON
                  try {
                    const errorJson = JSON.parse(errorText);
                    console.error('Gemini API Error Response:', errorJson);
                    
                    
                    // Parse error message từ response
                    if (errorJson.error) {
                      errorMessage = errorJson.error.message || '';
                      errorCode = errorJson.error.code || response.status;
                      
                      // Tạo error object với thông tin chi tiết
                      const detailedError = new Error(`HTTP ${errorCode}: ${errorMessage}`);
                      detailedError.code = errorCode;
                      detailedError.details = errorJson.error;
                      throw detailedError;
                    }
                  } catch (jsonParseError) {
                    // Không phải JSON, dùng text
                    errorMessage = errorText.substring(0, 200);
                  }
                } catch (textError) {
                  errorMessage = `HTTP ${response.status} Error`;
                }
                
                // Nếu chưa throw detailedError, throw error thông thường
                const finalError = new Error(`HTTP ${errorCode}: ${errorMessage || errorDetails.substring(0, 200)}`);
                finalError.code = errorCode;
                throw finalError;
              }
              
              const result = await response.json();
              
              if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
                const rawAnswer = result.candidates[0].content.parts[0].text;
                console.log(`Successfully used model: ${selectedModel}`);
                
                // Parse JSON response từ AI
                // Lưu ý: Gemini đôi khi bọc JSON trong ```json ... ```, cần clean trước khi parse
                try {
                  // Bước 1: Loại bỏ markdown code blocks (```json ... ``` hoặc ``` ... ```)
                  let cleanText = rawAnswer.trim();
                  
                  // Loại bỏ ```json ở đầu và ``` ở cuối
                  cleanText = cleanText.replace(/^```json\s*/i, '').replace(/^```\s*/, '');
                  cleanText = cleanText.replace(/\s*```$/i, '').trim();
                  
                  // Bước 2: Tìm JSON object trong response (có thể có text trước/sau JSON)
                  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const jsonString = jsonMatch[0];
                    const parsedResponse = JSON.parse(jsonString);
                    
                    // Validate cấu trúc JSON
                    if (parsedResponse.answer) {
                      answer = parsedResponse.answer;
                      // Cập nhật sources từ citations nếu có
                      if (parsedResponse.citations && Array.isArray(parsedResponse.citations)) {
                        sources = parsedResponse.citations;
                      }
                      // Lưu các field khác
                      analysis = parsedResponse.analysis || '';
                      suggestions = Array.isArray(parsedResponse.suggestions) ? parsedResponse.suggestions : [];
                      
                      // Enhance suggestions with context-aware suggestions from chat memory
                      if (sqlChatMemoryService && sqlPoolInitialized && userInfo && suggestions.length < 3) {
                        try {
                          const contextAwareSuggestions = await sqlChatMemoryService.getContextAwareSuggestions(
                            userId,
                            question,
                            {
                              maxSuggestions: 3 - suggestions.length,
                              sessionId: chatSessionId
                            }
                          );
                          
                          if (contextAwareSuggestions && contextAwareSuggestions.length > 0) {
                            suggestions = [...suggestions, ...contextAwareSuggestions].slice(0, 3);
                            console.log(`✅ Enhanced suggestions with ${contextAwareSuggestions.length} context-aware suggestions`);
                          }
                        } catch (suggestionError) {
                          console.warn('⚠️ Error getting context-aware suggestions:', suggestionError.message);
                        }
                      }
                      
                      console.log('✅ Parsed JSON response successfully');
                      console.log('   - Analysis:', analysis ? analysis.substring(0, 50) + '...' : 'N/A');
                      console.log('   - Citations:', sources.length);
                      console.log('   - Suggestions:', suggestions.length);
                    } else {
                      // Nếu không có field answer, dùng rawAnswer
                      console.warn('⚠️ JSON response không có field "answer", sử dụng raw answer');
                      answer = rawAnswer;
                    }
                  } else {
                    // Không tìm thấy JSON, dùng rawAnswer
                    console.warn('⚠️ AI response không phải JSON format, sử dụng raw answer');
                    console.warn('   Clean text preview:', cleanText.substring(0, 200));
                    answer = rawAnswer;
                  }
                } catch (parseError) {
                  // Nếu parse JSON lỗi, dùng rawAnswer
                  console.warn('⚠️ Lỗi parse JSON response:', parseError.message);
                  console.warn('   Raw answer preview:', rawAnswer.substring(0, 200));
                  answer = rawAnswer;
                }
              } else {
                throw new Error("Invalid response format from API");
              }
            } else {
              throw new Error("Không tìm thấy model nào có sẵn");
            }
          } catch (listError) {
            throw listError;
          }
        } else {
          // Fallback: Mock response nếu chưa có API key
          answer = `Bạn đã hỏi: "${question}".\n\n⚠️ Chưa cấu hình GEMINI_API_KEY.\n\nĐể sử dụng Google Gemini:\n1. Lấy API key từ https://makersuite.google.com/app/apikey\n2. Set environment variable:\n   firebase functions:secrets:set GEMINI_API_KEY\n3. Deploy lại Function`;
        }
      } catch (error) {
        console.error("Gemini API Error:", error);
        console.error("Error details:", error.details || error.message);
        
        // Parse error code và message
        const errorCode = error.code || (error.message && error.message.match(/HTTP (\d+)/)?.[1]) || 'UNKNOWN';
        const errorMessage = error.message || '';
        const errorDetails = error.details || {};
        
        // Xử lý lỗi theo từng loại
        if (errorCode === 401 || errorMessage.includes("API_KEY") || errorMessage.includes("API key") || errorMessage.includes("invalid API key")) {
          answer = `⚠️ **Lỗi: API key không hợp lệ hoặc chưa được cấu hình.**\n\n**Cách khắc phục:**\n\n1. **Kiểm tra API key hiện tại:**\n   \`firebase functions:secrets:access GEMINI_API_KEY\`\n\n2. **Tạo API key mới:**\n   - Truy cập: https://makersuite.google.com/app/apikey\n   - Tạo API key mới\n   - Set lại: \`echo YOUR_NEW_KEY | firebase functions:secrets:set GEMINI_API_KEY\`\n   - Deploy lại: \`firebase deploy --only functions\`\n\n3. **Kiểm tra API key có quyền:**\n   - Đảm bảo API key có quyền truy cập "Generative Language API"\n   - Enable API tại: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com`;
          
        } else if (errorCode === 429 || errorMessage.includes("quota") || errorMessage.includes("Quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
          // Kiểm tra xem có phải "limit: 0" (không có quota) hay "quota exceeded" (đã hết quota)
          const hasZeroLimit = errorMessage.includes("limit: 0");
          const modelInError = errorMessage.match(/model: ([^\s\n]+)/)?.[1] || 'unknown';
          const retryAfter = errorMessage.match(/Please retry in ([\d.]+)s/)?.[1];
          
          // Nếu model hiện tại có limit: 0, xóa cache để thử model khác ở lần sau
          console.log(`🔍 Debug cache clear: hasZeroLimit=${hasZeroLimit}, cachedModel="${cachedModel}", modelInError="${modelInError}"`);
          if (hasZeroLimit) {
            // Xóa cache nếu model có limit: 0 (không cần exact match vì có thể có variant)
            if (cachedModel && (cachedModel === modelInError || cachedModel.includes(modelInError) || modelInError.includes(cachedModel))) {
              console.log(`⚠️ Clearing model cache: ${cachedModel} has limit: 0, will try different model next time`);
              cachedModel = null;
              modelCacheTime = 0;
            } else if (hasZeroLimit) {
              // Nếu không match exact, vẫn xóa cache để thử model khác
              console.log(`⚠️ Clearing model cache (force): detected limit: 0, will try different model next time`);
              cachedModel = null;
              modelCacheTime = 0;
            }
          }
          
          if (hasZeroLimit) {
            answer = `⚠️ **Lỗi: API key không có quota free tier (limit: 0).**\n\n**Nguyên nhân:**\n- Model đang dùng: **${modelInError}**\n- API key của bạn không có free tier quota được cấp\n- Model ${modelInError} có thể yêu cầu billing enabled\n\n**Cách khắc phục:**\n\n1. **Tạo API key mới với free tier:**\n   - Truy cập: https://makersuite.google.com/app/apikey\n   - Tạo API key mới (đảm bảo chọn project có free tier)\n   - Set lại: \`echo YOUR_NEW_KEY | firebase functions:secrets:set GEMINI_API_KEY\`\n   - Deploy lại: \`firebase deploy --only functions\`\n\n2. **Enable billing (nếu muốn dùng model 2.0):**\n   - Vào Google Cloud Console\n   - Enable billing cho project\n   - Model 2.0 có thể yêu cầu billing\n\n3. **Sử dụng model miễn phí (khuyến nghị):**\n   - Function sẽ tự động chọn gemini-1.5-flash (model miễn phí)\n   - Model này có free tier quota cao\n   - Nếu vẫn lỗi, API key có thể không có free tier access`;
          } else {
            answer = `⚠️ **Lỗi: Đã vượt quá quota của Gemini API.**\n\n${retryAfter ? `⏰ **Có thể retry sau:** ${Math.ceil(parseFloat(retryAfter))} giây\n\n` : ''}**Cách khắc phục:**\n\n1. **Đợi reset quota:**\n   - Quota thường reset theo ngày/tháng\n   - Kiểm tra thời gian reset trong Console\n\n2. **Kiểm tra quota:**\n   - Truy cập: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas\n   - Xem quota hiện tại và thời gian reset\n\n3. **Tạo API key mới:**\n   - Đôi khi tạo API key mới sẽ có quota mới\n   - https://makersuite.google.com/app/apikey\n\n4. **Sử dụng model miễn phí:**\n   - Function đã tự động chọn model miễn phí (gemini-1.5-flash)\n   - Model này có quota cao hơn`;
          }
          
        } else if (errorCode === 404 || errorMessage.includes("404") || errorMessage.includes("not found") || errorMessage.includes("NOT_FOUND")) {
          answer = `⚠️ **Lỗi: Model không tìm thấy hoặc không được hỗ trợ.**\n\n**Lỗi chi tiết:** ${errorMessage}\n\n**Cách khắc phục:**\n\n1. **Kiểm tra API key:**\n   \`firebase functions:secrets:access GEMINI_API_KEY\`\n\n2. **Enable Generative Language API:**\n   - Truy cập: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n   - Click "Enable"\n\n3. **Tạo API key mới:**\n   - https://makersuite.google.com/app/apikey\n   - Set lại secret và deploy\n\n4. **Kiểm tra logs:**\n   \`firebase functions:log --only chatFunction\``;
          
        } else if (errorCode === 403 || errorMessage.includes("403") || errorMessage.includes("PERMISSION_DENIED")) {
          answer = `⚠️ **Lỗi: Không có quyền truy cập.**\n\n**Cách khắc phục:**\n\n1. **Kiểm tra API key có đúng project không**\n2. **Enable Generative Language API:**\n   https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n3. **Kiểm tra billing (nếu cần):**\n   Một số model yêu cầu billing enabled\n4. **Tạo API key mới với đầy đủ quyền**`;
          
        } else {
          answer = `⚠️ **Đã có lỗi xảy ra khi xử lý câu hỏi.**\n\n**Mã lỗi:** ${errorCode}\n**Chi tiết:** ${errorMessage.substring(0, 300)}\n\n**Cách khắc phục:**\n\n1. Kiểm tra logs: \`firebase functions:log --only chatFunction\`\n2. Kiểm tra API key: \`firebase functions:secrets:access GEMINI_API_KEY\`\n3. Thử tạo API key mới: https://makersuite.google.com/app/apikey\n4. Đảm bảo đã enable "Generative Language API"\n\nNếu vẫn lỗi, vui lòng kiểm tra logs để biết thêm chi tiết.`;
        }
      }
      
      // ============================================
      // TODO: Thêm logic RAG nếu cần
      // ============================================
      // 1. Tìm kiếm tài liệu liên quan từ vector database
      // 2. Thêm context vào prompt
      // 3. Cập nhật sources array với tài liệu tìm được
      
      // Tạo response object với các field đã được parse
      const response = {
        answer: answer,
        sources: sources,
        citations: sources, // Alias cho compatibility
        // Thêm các field mới nếu có
        ...(analysis && { analysis }),
        ...(suggestions.length > 0 && { suggestions })
      };

      // Save chat memory to database (async, don't wait)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:1203',message:'Checking save memory conditions',data:{hasService:!!sqlChatMemoryService,sqlPoolInitialized,hasUserInfo:!!userInfo,hasSessionId:!!chatSessionId,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      console.log('🔍 DEBUG: Save memory check', {
        hasService: !!sqlChatMemoryService,
        sqlPoolInitialized,
        hasUserInfo: !!userInfo,
        hasSessionId: !!chatSessionId,
        userId
      });
      // #endregion
      if (sqlChatMemoryService && sqlPoolInitialized && userInfo) {
        try {
          // Save user question
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:1206',message:'Saving user memory',data:{userId,questionLength:question.length,chatSessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          const userMemoryId = await sqlChatMemoryService.saveChatMemory(
            userId,
            question,
            'user',
            chatSessionId,
            {
              timestamp: new Date().toISOString(),
              suggestions: suggestions // Store suggestions in metadata for future use
            }
          );
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:1215',message:'User memory saved',data:{userMemoryId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          // Save assistant answer
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:1218',message:'Saving assistant memory',data:{userId,answerLength:answer.length,chatSessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          const assistantMemoryId = await sqlChatMemoryService.saveChatMemory(
            userId,
            answer,
            'assistant',
            chatSessionId,
            {
              timestamp: new Date().toISOString(),
              citations: sources,
              suggestions: suggestions
            }
          );
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:1228',message:'Assistant memory saved',data:{assistantMemoryId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          console.log('✅ Chat memory saved to database:', {
            sessionId: chatSessionId,
            userMemoryId,
            assistantMemoryId
          });
        } catch (memoryError) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:1235',message:'Memory save failed',data:{error:memoryError.message,stack:memoryError.stack?.substring(0,300),name:memoryError.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          console.warn('⚠️ Error saving chat memory:', memoryError.message);
          console.warn('   Error stack:', memoryError.stack?.substring(0, 200));
          // Don't fail the request if memory save fails
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.js:1240',message:'Skipping SQL save, using fallback',data:{hasService:!!sqlChatMemoryService,sqlPoolInitialized,hasUserInfo:!!userInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        console.log('🔍 DEBUG: Skipping SQL save - conditions not met', {
          hasService: !!sqlChatMemoryService,
          sqlPoolInitialized,
          hasUserInfo: !!userInfo,
          reason: !sqlChatMemoryService ? 'no service' : !sqlPoolInitialized ? 'pool not initialized' : 'no userInfo'
        });
        // #endregion
        
        // Fallback: Save to Firestore if SQL Server not available
        if (userInfo && db) {
          try {
            const memoryRef = db.collection('chatMemory');
            const sessionRef = db.collection('chatSessions');
            
            // Get or create session
            let sessionDoc = null;
            const sessionQuery = await sessionRef.where('userId', '==', userId).where('isActive', '==', true).limit(1).get();
            
            if (!sessionQuery.empty) {
              sessionDoc = sessionQuery.docs[0];
            } else {
              // Create new session
              sessionDoc = await sessionRef.add({
                userId: userId,
                title: question.substring(0, 100),
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
                messageCount: 0,
                isActive: true
              });
            }
            
            const sessionId = sessionDoc.id;
            
            // Save user message
            await memoryRef.add({
              userId: userId,
              sessionId: sessionId,
              content: question,
              contentType: 'user',
              metadata: {
                timestamp: new Date().toISOString(),
                suggestions: suggestions
              },
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Save assistant message
            await memoryRef.add({
              userId: userId,
              sessionId: sessionId,
              content: answer,
              contentType: 'assistant',
              metadata: {
                timestamp: new Date().toISOString(),
                citations: sources,
                suggestions: suggestions
              },
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Update session
            await sessionRef.doc(sessionId).update({
              lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
              messageCount: admin.firestore.FieldValue.increment(2)
            });
            
            console.log('✅ Chat memory saved to Firestore (fallback):', sessionId);
          } catch (firestoreError) {
            console.warn('⚠️ Error saving chat memory to Firestore:', firestoreError.message);
          }
        }
      }

      // Return success response
      return res.status(200).json(response);
      } catch (error) {
        // Catch any unhandled errors
        console.error("Unhandled error in chatFunction:", error);
        console.error("Error stack:", error.stack);
        
        // Return error response
        return res.status(500).json({
          error: "Internal Server Error",
          message: error.message || "An unexpected error occurred",
          details: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
      }
    });
  }
);

/**
 * Helper function: Check if question is related to email
 */
function isEmailRelatedQuestion(question) {
  if (!question || typeof question !== 'string') {
    return false;
  }
  const emailKeywords = [
    'email', 'mail', 'thư', 'gmail', 'outlook',
    'gửi', 'nhận', 'xin nghỉ', 'nghỉ phép', 'đơn xin',
    'tìm email', 'tìm thư', 'email nào', 'thư nào',
    'email mới', 'thư mới', 'có email', 'có thư',
    'hợp mail', 'hộp thư', 'hộp mail', 'mail mới',
    'thư đến', 'inbox', 'hộp thư đến'
  ];
  const lowerQuestion = question.toLowerCase();
  // Normalize: remove diacritics for better matching
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const matchedKeywords = emailKeywords.filter(k => {
    const normalizedKeyword = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  const isEmail = matchedKeywords.length > 0;
  // #region agent log
  console.log('🔍 isEmailRelatedQuestion:', {
    question: question.substring(0, 50),
    lowerQuestion: lowerQuestion.substring(0, 50),
    normalizedQuestion: normalizedQuestion.substring(0, 50),
    isEmail,
    matchedKeywords
  });
  // #endregion
  return isEmail;
}

/**
 * Helper function: Check if question is related to TSMay data
 * Also detects questions about LSX, SBB, TBKT, Soá maùy (số máy), etc.
 */
function isTSMayRelatedQuestion(question) {
  if (!question || typeof question !== 'string') {
    return false;
  }
  const tsMayKeywords = [
    'tsmay', 'ts may', 'tìm tsmay', 'tìm ts may',
    'dữ liệu tsmay', 'du lieu tsmay', 'dữ liệu ts may', 'du lieu ts may',
    'excel tsmay', 'excel ts may', 'bảng tsmay', 'bang tsmay',
    'bảng ts may', 'bang ts may', 'import tsmay', 'import ts may',
    'dữ liệu excel', 'du lieu excel', 'bảng excel', 'bang excel',
    'tìm trong tsmay', 'tìm trong ts may', 'trong tsmay', 'trong ts may',
    'có tsmay', 'co tsmay', 'có ts may', 'co ts may',
    'liệt kê tsmay', 'liet ke tsmay', 'liệt kê ts may', 'liet ke ts may',
    'danh sách tsmay', 'danh sach tsmay', 'danh sách ts may', 'danh sach ts may'
  ];
  
  // Keywords for TSMay data fields (LSX, SBB, TBKT, số máy, etc.)
  const tsMayFieldKeywords = [
    'lsx', 'sbb', 'tbkt', 'soá maùy', 'so may', 'soá may', 'so may',
    'số máy', 'số may', 'so may', 'maùy', 'may',
    'kieåu maùy', 'kieu may', 'kiểu máy', 'kieu may',
    't.chuaån lsx', 't.chuan lsx', 't chuan lsx', 'tieu chuan lsx',
    'po', 'io', 'pk75', 'uk75', 'udm hv', 'lv', 'udm daáu do',
    'dau', 'ngaøy xx', 'ngay xx', 'ngày xx', 'bnc',
    'tìm tbkt', 'tim tbkt', 'tìm trong tbkt', 'tim trong tbkt',
    'có tbkt', 'co tbkt', 'tbkt nào', 'tbkt nao'
  ];
  
  const lowerQuestion = question.toLowerCase();
  // Normalize: remove diacritics for better matching
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Check for TSMay keywords
  const matchedKeywords = tsMayKeywords.filter(k => {
    const normalizedKeyword = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  
  // Check for TSMay field keywords (LSX, SBB, etc.)
  const matchedFieldKeywords = tsMayFieldKeywords.filter(k => {
    const normalizedKeyword = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  
  // Check if question contains a long number (likely a code like LSX 2081001453)
  // Pattern: "LSX" or "lsx" followed by a number, or just a long number (10+ digits)
  const hasLSXPattern = /lsx\s*\d{6,}/i.test(question) || /\d{10,}/.test(question);
  
  // Check if question asks "có ... nào" (is there any ...) with a code
  const hasCodePattern = /có\s+[a-z]{2,}\s*\d+/.test(normalizedQuestion) || 
                         /co\s+[a-z]{2,}\s*\d+/.test(normalizedQuestion);
  
  // Check for TBKT pattern: alphanumeric codes like "24142TJ", "25076D" (numbers + letters)
  // Pattern: 4-6 digits followed by 1-3 letters (e.g., "24142TJ", "25076D")
  const hasTBKTPattern = /\d{4,6}[a-z]{1,3}/i.test(question);
  
  // Check if question mentions "TBKT" or "tbkt" explicitly
  const hasTBKTKeyword = /tbkt/i.test(question);
  
  // Check if question asks "tìm ... trong TBKT" or "tìm ... trong tbkt"
  const hasTBKTSearchPattern = /tìm\s+[^\s]+\s+trong\s+tbkt/i.test(question) ||
                                /tim\s+[^\s]+\s+trong\s+tbkt/i.test(question);
  
  const isTSMay = matchedKeywords.length > 0 || 
                  matchedFieldKeywords.length > 0 || 
                  hasLSXPattern || 
                  hasCodePattern ||
                  hasTBKTPattern ||
                  hasTBKTKeyword ||
                  hasTBKTSearchPattern;
  
  // #region agent log
  console.log('🔍 isTSMayRelatedQuestion:', {
    question: question.substring(0, 50),
    lowerQuestion: lowerQuestion.substring(0, 50),
    normalizedQuestion: normalizedQuestion.substring(0, 50),
    isTSMay,
    matchedKeywords,
    matchedFieldKeywords,
    hasLSXPattern,
    hasCodePattern,
    hasTBKTPattern,
    hasTBKTKeyword,
    hasTBKTSearchPattern
  });
  // #endregion
  return isTSMay;
}

/**
 * Helper function: Generate embedding vector using Gemini
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Gemini embedding API endpoint
    // Note: Gemini uses text-embedding-004 model
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{
            text: text
          }]
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.embedding || !data.embedding.values) {
      throw new Error('Invalid embedding response from Gemini');
    }

    return data.embedding.values;
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    throw error;
  }
}

/**
 * Helper function: Calculate cosine similarity between two vectors
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} Cosine similarity (0-1, higher is more similar)
 */
function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Helper function: Create text representation of TSMay document for embedding
 * @param {Object} doc - Document data
 * @returns {string} Text representation
 */
function createDocumentText(doc) {
  const displayData = doc._originalData || doc;
  const parts = [];
  
  // Add important fields first
  const importantFields = [
    'kVA', 'Soá maùy', 'Số máy', 'SBB', 'LSX', 'TBKT', 
    'T.Chuaån LSX', 'T.Chuẩn LSX', 'Kieåu maùy', 'Kiểu máy',
    'Po (W)', 'Io (%)', 'Pk75 (W)', 'Uk75 (%)', 
    'Uñm HV', 'Uđm HV', 'LV', 'Ngaøy XX', 'Ngày XX', 'BNC'
  ];
  
  // Add important fields
  importantFields.forEach(fieldName => {
    const fieldKey = Object.keys(displayData).find(key => 
      key.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase().replace(/\s+/g, '') ||
      key === fieldName
    );
    
    if (fieldKey && displayData[fieldKey] !== null && displayData[fieldKey] !== undefined) {
      const value = displayData[fieldKey];
      if (value !== '' && value !== null && value !== undefined) {
        parts.push(`${fieldKey}: ${value}`);
      }
    }
  });
  
  // Add other fields
  Object.keys(displayData).forEach(key => {
    if (key.startsWith('_') || key === 'id') return;
    
    const isImportant = importantFields.some(field => 
      key.toLowerCase().replace(/\s+/g, '') === field.toLowerCase().replace(/\s+/g, '') ||
      key === field
    );
    
    if (!isImportant && displayData[key] !== null && displayData[key] !== undefined) {
      const value = displayData[key];
      if (value !== '' && value !== null && value !== undefined) {
        parts.push(`${key}: ${value}`);
      }
    }
  });
  
  return parts.join(', ');
}

/**
 * Helper function: Check if document matches text search terms
 * @param {Object} doc - Document to check
 * @param {string[]} searchTerms - Search terms
 * @returns {boolean} True if document matches
 */
function checkTextMatch(doc, searchTerms) {
  const priorityFields = [
    'lsx', 'sbb', 'tbkt', 
    'soá_maùy', 'so_may', 'so_may', 'số_máy', 'soá_may', 'so_máy',
    'maùy', 'may', 'máy',
    'kieåu_maùy', 'kieu_may', 'kiểu_máy', 'kieu_máy',
    't_chuaån_lsx', 't_chuan_lsx', 'tieu_chuan_lsx', 't_chuẩn_lsx',
    'soá maùy', 'so may', 'số máy', 'kiểu máy', 't.chuaån lsx'
  ];
  
  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase().trim();
    
    // Check in priority fields first
    for (const field of priorityFields) {
      const fieldValue = doc[field];
      if (fieldValue !== null && fieldValue !== undefined) {
        const fieldValueStr = String(fieldValue).toLowerCase();
        if (fieldValueStr === lowerTerm || fieldValueStr.includes(lowerTerm) || 
            lowerTerm.includes(fieldValueStr)) {
          return true;
        }
      }
    }
    
    // Also check in all fields (case-insensitive)
    for (const key in doc) {
      if (key === 'id' || key.startsWith('_')) continue;
      const value = doc[key];
      if (value !== null && value !== undefined) {
        const valueStr = String(value).toLowerCase();
        const valueStrNoSpace = valueStr.replace(/\s+/g, '');
        const termNoSpace = lowerTerm.replace(/\s+/g, '');
        
        if (valueStr === lowerTerm || valueStr.includes(lowerTerm) || 
            lowerTerm.includes(valueStr) ||
            valueStrNoSpace === termNoSpace || valueStrNoSpace.includes(termNoSpace) ||
            termNoSpace.includes(valueStrNoSpace)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Helper function: Check if question is asking for counting/aggregation
 * Examples: "có bao nhiêu", "how many", "đếm", "count", "tổng số"
 */
function isAggregationQuestion(question) {
  if (!question || typeof question !== 'string') {
    return false;
  }
  
  const lowerQuestion = question.toLowerCase();
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  const aggregationKeywords = [
    'co bao nhieu', 'có bao nhiêu', 'bao nhieu', 'bao nhiêu',
    'how many', 'how much', 'count', 'dem', 'đếm',
    'tong so', 'tổng số', 'total', 'tat ca', 'tất cả',
    'list', 'danh sach', 'danh sách', 'liet ke', 'liệt kê',
    'nhom', 'nhóm', 'group', 'theo', 'by'
  ];
  
  return aggregationKeywords.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
}

/**
 * Helper function: Perform aggregation on TSMay data
 * Supports: count, count distinct, group by, filter and count
 */
function performAggregation(documents, question) {
  if (!documents || documents.length === 0) {
    return {
      type: 'count',
      result: 0,
      message: 'Không có dữ liệu để phân tích.'
    };
  }
  
  const lowerQuestion = question.toLowerCase();
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Extract filter criteria (e.g., "TBKT 20161D", "LSX 2081001453")
  const tbktPattern = /tbkt\s*([a-z0-9]+)/i;
  const lsxPattern = /lsx\s*(\d+)/i;
  const sbbPattern = /sbb\s*(\d+)/i;
  const soMayPattern = /(?:so|số)\s*(?:may|máy|maùy|maùy)\s*([a-z0-9]+)/i;
  
  let filterField = null;
  let filterValue = null;
  
  const tbktMatch = question.match(tbktPattern);
  if (tbktMatch) {
    filterField = 'TBKT';
    filterValue = tbktMatch[1].toUpperCase();
  }
  
  const lsxMatch = question.match(lsxPattern);
  if (lsxMatch) {
    filterField = 'LSX';
    filterValue = lsxMatch[1];
  }
  
  const sbbMatch = question.match(sbbPattern);
  if (sbbMatch) {
    filterField = 'SBB';
    filterValue = sbbMatch[1];
  }
  
  // Extract what to count (e.g., "số máy", "máy", "số lượng")
  let countField = null;
  if (/so|số|số lượng|quantity|count/i.test(question)) {
    if (/may|máy|maùy|machine/i.test(question)) {
      countField = 'Soá maùy'; // or 'Số máy'
    }
  }
  
  // Filter documents based on criteria
  let filteredDocs = documents;
  if (filterField && filterValue) {
    filteredDocs = documents.filter(doc => {
      const displayData = doc._originalData || doc;
      
      // Try to find the field (case-insensitive, with/without spaces)
      const fieldKey = Object.keys(displayData).find(key => {
        const keyNormalized = key.toLowerCase().replace(/\s+/g, '');
        const filterFieldNormalized = filterField.toLowerCase().replace(/\s+/g, '');
        return keyNormalized === filterFieldNormalized || 
               keyNormalized.includes(filterFieldNormalized) ||
               filterFieldNormalized.includes(keyNormalized);
      });
      
      if (fieldKey) {
        const fieldValue = String(displayData[fieldKey] || '').toUpperCase().replace(/\s+/g, '');
        const filterValueNormalized = filterValue.toUpperCase().replace(/\s+/g, '');
        return fieldValue === filterValueNormalized || 
               fieldValue.includes(filterValueNormalized) ||
               filterValueNormalized.includes(fieldValue);
      }
      
      return false;
    });
  }
  
  // Count based on what user asked
  let result = 0;
  let resultMessage = '';
  
  if (countField) {
    // Count distinct values of a specific field
    const distinctValues = new Set();
    filteredDocs.forEach(doc => {
      const displayData = doc._originalData || doc;
      const fieldKey = Object.keys(displayData).find(key => {
        const keyNormalized = key.toLowerCase().replace(/\s+/g, '');
        const countFieldNormalized = countField.toLowerCase().replace(/\s+/g, '');
        return keyNormalized === countFieldNormalized || 
               keyNormalized.includes(countFieldNormalized);
      });
      
      if (fieldKey && displayData[fieldKey]) {
        const value = String(displayData[fieldKey]).trim();
        if (value) {
          distinctValues.add(value);
        }
      }
    });
    result = distinctValues.size;
    resultMessage = `Có **${result}** ${countField} ${filterField && filterValue ? `trong ${filterField} ${filterValue}` : ''}`;
  } else {
    // Simple count of documents
    result = filteredDocs.length;
    if (filterField && filterValue) {
      resultMessage = `Có **${result}** bản ghi với ${filterField} = ${filterValue}`;
    } else {
      resultMessage = `Tổng số bản ghi: **${result}**`;
    }
  }
  
  return {
    type: 'aggregation',
    result,
    message: resultMessage,
    filteredCount: filteredDocs.length,
    totalCount: documents.length,
    filterCriteria: filterField && filterValue ? { field: filterField, value: filterValue } : null,
    sampleData: filteredDocs.slice(0, 5).map(doc => {
      const displayData = doc._originalData || doc;
      return {
        id: doc.id,
        ...displayData
      };
    })
  };
}

/**
 * Helper function: Search TSMay data (Firestore or SQL Server)
 */
async function searchTSMayData(question) {
  try {
    // #region agent log
    console.log('🔍 searchTSMayData started:', {
      question: question.substring(0, 50),
      useSQL: !!sqlTSMayService && !!process.env.SQL_SERVER_HOST
    });
    // #endregion
    
    // Try SQL Server first if configured
    if (sqlTSMayService && process.env.SQL_SERVER_HOST) {
      try {
        console.log('📊 Using SQL Server for TSMay search...');
        const sqlResult = await sqlTSMayService.searchTSMayWithVector(question, {
          similarityThreshold: 0.3,
          topN: 10
        });
        
        if (sqlResult.records && sqlResult.records.length > 0) {
          // Format SQL results similar to Firestore format
          // Remove duplicates based on DocumentId or key fields
          const uniqueRecords = [];
          const seenIds = new Set();
          const seenKeys = new Set();
          
          sqlResult.records.forEach(record => {
            const data = record.data || {};
            // Try to create a unique key from DocumentId or key fields
            let uniqueKey = record.DocumentId;
            
            // If no DocumentId, try to create key from important fields
            if (!uniqueKey || seenIds.has(uniqueKey)) {
              const keyFields = ['Số máy', 'Soá maùy', 'B', 'SBB', 'C'];
              const keyParts = [];
              for (const field of keyFields) {
                if (data[field] != null) {
                  keyParts.push(`${field}:${data[field]}`);
                }
              }
              uniqueKey = keyParts.join('|') || `record_${record.Id}`;
            }
            
            if (!seenKeys.has(uniqueKey)) {
              seenKeys.add(uniqueKey);
              seenIds.add(record.DocumentId || uniqueKey);
              uniqueRecords.push(record);
            }
          });
          
          let tsMayContext = `Tìm thấy ${sqlResult.totalFound} bản ghi trong TSMay (SQL Server)`;
          if (uniqueRecords.length < sqlResult.totalFound) {
            tsMayContext += ` (${uniqueRecords.length} bản ghi duy nhất sau khi loại bỏ trùng lặp)`;
          }
          tsMayContext += `:\n\n`;
          
          // Show all unique records (limit to top 50 for performance)
          const displayRecords = uniqueRecords.slice(0, 50);
          displayRecords.forEach((record, index) => {
            tsMayContext += `**Bản ghi ${index + 1}**`;
            if (record.similarity !== undefined && record.similarity < 1.0) {
              tsMayContext += ` (ID: ${record.DocumentId || record.Id}, Similarity: ${(record.similarity * 100).toFixed(2)}%)`;
            } else if (record.DocumentId || record.Id) {
              tsMayContext += ` (ID: ${record.DocumentId || record.Id})`;
            }
            tsMayContext += `:\n`;
            
            const data = record.data || {};
            // Show important fields first
            const importantFields = ['KVA', 'kVA', 'A', 'Số máy', 'Soá maùy', 'B', 'SBB', 'C', 'LSX', 'D', 'TBKT', 'F'];
            const shownFields = new Set();
            
            // Show important fields first
            importantFields.forEach(field => {
              if (data[field] != null && !shownFields.has(field)) {
                tsMayContext += `  - **${field}**: ${data[field]}\n`;
                shownFields.add(field);
              }
            });
            
            // Show other fields
            Object.keys(data).forEach(key => {
              if (key && data[key] !== null && data[key] !== undefined && !shownFields.has(key)) {
                tsMayContext += `  - **${key}**: ${data[key]}\n`;
                shownFields.add(key);
              }
            });
            
            tsMayContext += `\n`;
          });
          
          if (uniqueRecords.length > 50) {
            tsMayContext += `\n... và còn ${uniqueRecords.length - 50} bản ghi khác.\n`;
          }
          
          return tsMayContext;
        }
      } catch (sqlError) {
        console.warn('⚠️ SQL Server search failed, falling back to Firestore:', sqlError.message);
        // Fall through to Firestore search
      }
    }
    
    // Fallback to Firestore search
    return await searchTSMayDataFirestore(question);
  } catch (error) {
    console.error('❌ Error in searchTSMayData:', error);
    throw error;
  }
}

/**
 * Helper function: Search TSMay data in Firestore (original implementation)
 */
async function searchTSMayDataFirestore(question) {
  try {
    // #region agent log
    console.log('🔍 searchTSMayDataFirestore started:', {
      question: question.substring(0, 50)
    });
    // #endregion
    
    // Extract search terms from question
    const searchTerms = extractTSMaySearchTerms(question);
    
    // Get TSMay collection from Firestore
    const tsMayRef = db.collection('TSMay');
    let query = tsMayRef;
    
    // Increase limit to 500 documents for better search coverage
    // If search terms are provided, we'll filter in memory
    query = query.limit(500);
    
    // Execute query
    const snapshot = await query.get();
    
    // Try semantic search with vector embeddings
    let useSemanticSearch = false;
    let queryEmbedding = null;
    
    try {
      // Generate embedding for the question
      queryEmbedding = await generateEmbedding(question);
      useSemanticSearch = true;
      console.log('✅ Generated query embedding, length:', queryEmbedding.length);
    } catch (embeddingError) {
      console.warn('⚠️ Failed to generate embedding, falling back to text search:', {
        error: embeddingError.message
      });
      useSemanticSearch = false;
    }
    
    if (snapshot.empty) {
      // #region agent log
      console.log('⚠️ No TSMay documents found');
      // #endregion
      return 'Không tìm thấy dữ liệu nào trong collection TSMay.';
    }
    
    // #region agent log
    console.log('✅ Found TSMay documents:', snapshot.size);
    // #endregion
    
    // Convert documents to array with original column names
    const documents = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Get column mapping if available (to restore original column names)
      const columnMapping = data._columnMapping || {};
      const originalColumns = data._originalColumns || [];
      
      // Create reverse mapping: sanitized -> original
      const reverseMapping = {};
      Object.keys(columnMapping).forEach(originalName => {
        const sanitized = columnMapping[originalName];
        reverseMapping[sanitized] = originalName;
      });
      
      // Build clean data with original column names where possible
      const cleanData = {};
      const cleanDataWithOriginalNames = {};
      
      Object.keys(data).forEach(key => {
        if (!key.startsWith('_')) {
          cleanData[key] = data[key];
          // Map back to original name if available
          const originalName = reverseMapping[key] || key;
          cleanDataWithOriginalNames[originalName] = data[key];
        }
      });
      
      // Get embedding if available
      const embedding = data._embedding || null;
      
      documents.push({
        id: doc.id,
        ...cleanData, // Keep sanitized names for searching
        _originalData: cleanDataWithOriginalNames, // Store with original names for display
        _columnMapping: columnMapping,
        _originalColumns: originalColumns,
        _embedding: embedding // Store embedding for semantic search
      });
    });
    
    // Filter and rank documents
    let filteredDocs = documents;
    
    // If semantic search is available, use it
    if (useSemanticSearch && queryEmbedding) {
      // Calculate similarity for documents with embeddings
      const docsWithSimilarity = documents.map(doc => {
        let similarity = 0;
        
        if (doc._embedding && Array.isArray(doc._embedding)) {
          try {
            similarity = cosineSimilarity(queryEmbedding, doc._embedding);
          } catch (error) {
            console.warn('Error calculating similarity for doc', doc.id, error);
            similarity = 0;
          }
        }
        
        return {
          ...doc,
          _similarity: similarity
        };
      });
      
      // Sort by similarity (highest first)
      docsWithSimilarity.sort((a, b) => b._similarity - a._similarity);
      
      // Filter: take top results with similarity > 0.3 (threshold)
      // Also include documents without embeddings if they match text search
      filteredDocs = docsWithSimilarity.filter(doc => {
        if (doc._similarity > 0.3) {
          return true; // High similarity, include
        }
        
        // If no embedding or low similarity, check text match
        if (searchTerms.length > 0) {
          return checkTextMatch(doc, searchTerms);
        }
        
        return false;
      });
      
      // If no semantic matches, fallback to text search
      if (filteredDocs.length === 0 && searchTerms.length > 0) {
        console.log('⚠️ No semantic matches, falling back to text search');
        useSemanticSearch = false;
      } else {
        console.log(`✅ Semantic search found ${filteredDocs.length} documents with similarity > 0.3`);
      }
    }
    
    // Text-based filtering (fallback or when no semantic search)
    if (!useSemanticSearch || filteredDocs.length === 0) {
      if (searchTerms.length > 0) {
        filteredDocs = documents.filter(doc => checkTextMatch(doc, searchTerms));
        
        // #region agent log
        console.log('🔍 Filtered documents (text search):', {
          originalCount: documents.length,
          filteredCount: filteredDocs.length,
          searchTerms
        });
        // #endregion
      }
    }
    
    // Check if this is an aggregation question (count, group, etc.)
    const isAggregation = isAggregationQuestion(question);
    
    if (isAggregation) {
      // Perform aggregation analysis
      const aggregationResult = performAggregation(filteredDocs.length > 0 ? filteredDocs : documents, question);
      
      let aggregationContext = `**KẾT QUẢ PHÂN TÍCH DỮ LIỆU TSMay:**\n\n`;
      aggregationContext += `${aggregationResult.message}\n\n`;
      
      if (aggregationResult.filterCriteria) {
        aggregationContext += `**Điều kiện lọc:** ${aggregationResult.filterCriteria.field} = ${aggregationResult.filterCriteria.value}\n\n`;
      }
      
      aggregationContext += `**Thống kê:**\n`;
      aggregationContext += `- Số bản ghi tìm thấy: ${aggregationResult.filteredCount}\n`;
      aggregationContext += `- Tổng số bản ghi trong TSMay: ${aggregationResult.totalCount}\n\n`;
      
      if (aggregationResult.sampleData && aggregationResult.sampleData.length > 0) {
        aggregationContext += `**Mẫu dữ liệu (${Math.min(5, aggregationResult.sampleData.length)} bản ghi đầu tiên):**\n\n`;
        aggregationResult.sampleData.forEach((doc, index) => {
          aggregationContext += `**Bản ghi ${index + 1}** (ID: ${doc.id}):\n`;
          const importantFields = ['kVA', 'Soá maùy', 'Số máy', 'SBB', 'LSX', 'TBKT', 'Kiểu máy'];
          importantFields.forEach(fieldName => {
            const fieldKey = Object.keys(doc).find(key => 
              key.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase().replace(/\s+/g, '') ||
              key === fieldName
            );
            if (fieldKey && doc[fieldKey] !== null && doc[fieldKey] !== undefined) {
              aggregationContext += `  - **${fieldKey}**: ${doc[fieldKey]}\n`;
            }
          });
          aggregationContext += `\n`;
        });
      }
      
      return aggregationContext;
    }
    
    // Limit to top 10 documents for context (reduced to avoid too long context)
    const topDocs = filteredDocs.slice(0, 10);
    
    if (topDocs.length === 0) {
      return `Không tìm thấy dữ liệu TSMay phù hợp với từ khóa: "${searchTerms.join(', ')}".\n\nTổng số bản ghi trong TSMay: ${documents.length}`;
    }
    
    // Format results with original column names and better structure
    let tsMayContext = `Tìm thấy ${filteredDocs.length} bản ghi trong TSMay (hiển thị ${topDocs.length} bản ghi đầu tiên):\n\n`;
    
    // Define important fields to prioritize in display (use original names)
    const importantFields = [
      'kVA', 'Soá maùy', 'Số máy', 'SBB', 'LSX', 'TBKT', 
      'T.Chuaån LSX', 'T.Chuẩn LSX', 'Kieåu maùy', 'Kiểu máy',
      'Po (W)', 'Io (%)', 'Pk75 (W)', 'Uk75 (%)', 
      'Uñm HV', 'Uđm HV', 'LV', 'Ngaøy XX', 'Ngày XX', 'BNC'
    ];
    
    topDocs.forEach((doc, index) => {
      tsMayContext += `**Bản ghi ${index + 1}** (ID: ${doc.id}):\n`;
      
      // Use original data if available, otherwise use sanitized
      const displayData = doc._originalData || doc;
      
      // First, show important fields
      const shownFields = new Set();
      
      // Show important fields first
      importantFields.forEach(fieldName => {
        // Try to find field (case-insensitive, with/without spaces)
        const fieldKey = Object.keys(displayData).find(key => 
          key.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase().replace(/\s+/g, '') ||
          key === fieldName
        );
        
        if (fieldKey && displayData[fieldKey] !== null && displayData[fieldKey] !== undefined) {
          const value = displayData[fieldKey];
          let displayValue = value;
          if (value instanceof Date) {
            displayValue = value.toLocaleString('vi-VN');
          } else if (typeof value === 'object' && value !== null) {
            displayValue = JSON.stringify(value);
          } else if (value === null || value === undefined) {
            displayValue = '(trống)';
          }
          tsMayContext += `  - **${fieldKey}**: ${displayValue}\n`;
          shownFields.add(fieldKey);
        }
      });
      
      // Then show other fields (not in important list)
      Object.keys(displayData).forEach(key => {
        // Skip metadata and already shown fields
        if (key.startsWith('_') || shownFields.has(key) || key === 'id') {
          return;
        }
        
        const value = displayData[key];
        if (value !== null && value !== undefined) {
          let displayValue = value;
          if (value instanceof Date) {
            displayValue = value.toLocaleString('vi-VN');
          } else if (typeof value === 'object' && value !== null) {
            displayValue = JSON.stringify(value);
          }
          tsMayContext += `  - **${key}**: ${displayValue}\n`;
        }
      });
      
      tsMayContext += `\n`;
    });
    
    if (filteredDocs.length > topDocs.length) {
      tsMayContext += `\n... và còn ${filteredDocs.length - topDocs.length} bản ghi khác.\n`;
    }
    
    // Add summary information
    tsMayContext += `\n**Lưu ý:** Dữ liệu được hiển thị với tên cột gốc từ Excel. Nếu cần tìm kiếm thêm, bạn có thể hỏi về các field cụ thể như: kVA, Số máy, LSX, SBB, TBKT, Kiểu máy, v.v.`;
    
    return tsMayContext;
  } catch (error) {
    // #region agent log
    console.error('❌ Error searching TSMay data:', {
      error: error.message,
      errorStack: error.stack?.substring(0, 200)
    });
    // #endregion
    
    // Handle specific error cases
    const errorMessage = error.message || '';
    if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
      throw new Error(`Không có quyền truy cập collection TSMay. Vui lòng kiểm tra Firestore rules.`);
    }
    
    // For other errors, throw with original message
    throw error;
  }
}

/**
 * Helper function: Extract search terms from question for TSMay search
 * Improved to extract codes like "LSX 2081001453" as complete terms
 */
function extractTSMaySearchTerms(question) {
  if (!question || typeof question !== 'string') {
    return [];
  }
  
  const lowerQuestion = question.toLowerCase();
  const terms = [];
  
  // First, extract codes with patterns like "LSX 2081001453" or "LSX2081001453"
  // Pattern: 2-4 letters followed by space (optional) and numbers
  const codePattern = /([a-z]{2,4})\s*(\d{6,})/gi;
  const codeMatches = question.matchAll(codePattern);
  for (const match of codeMatches) {
    const code = match[0].replace(/\s+/g, ''); // Remove spaces: "LSX 2081001453" -> "LSX2081001453"
    const codeWithSpace = match[0]; // Keep with space: "LSX 2081001453"
    const numberOnly = match[2]; // Just the number: "2081001453"
    terms.push(code, codeWithSpace, numberOnly);
  }
  
  // Extract TBKT pattern: alphanumeric codes like "24142TJ", "25076D" (numbers + letters)
  // Pattern: 4-6 digits followed by 1-3 letters
  const tbktPattern = /(\d{4,6}[a-z]{1,3})/gi;
  const tbktMatches = question.matchAll(tbktPattern);
  for (const match of tbktMatches) {
    const tbktCode = match[0].toUpperCase(); // "24142TJ" -> "24142TJ"
    terms.push(tbktCode, tbktCode.toLowerCase());
  }
  
  // Extract standalone long numbers (10+ digits) - likely codes
  const longNumberPattern = /\d{10,}/g;
  const longNumbers = question.match(longNumberPattern);
  if (longNumbers) {
    terms.push(...longNumbers);
  }
  
  // Extract field codes (LSX, SBB, TBKT, etc.) even without numbers
  const fieldCodePattern = /\b(lsx|sbb|tbkt|soá\s*maùy|so\s*may|số\s*máy|kieu\s*may|kiểu\s*máy)\b/gi;
  const fieldCodes = question.match(fieldCodePattern);
  if (fieldCodes) {
    terms.push(...fieldCodes.map(code => code.toLowerCase().replace(/\s+/g, '')));
  }
  
  // Remove common question words and TSMay keywords
  const stopWords = [
    'tsmay', 'ts may', 'tìm', 'tim', 'trong', 'rong', 'có', 'co',
    'những', 'nhung', 'nào', 'nao', 'gì', 'gi', 'đâu', 'dau',
    'thế', 'the', 'bao', 'nhiêu', 'nhieu', 'của', 'cua',
    'tôi', 'toi', 'bạn', 'ban', 'liệt kê', 'liet ke',
    'danh sách', 'danh sach', 'list', 'excel', 'bảng', 'bang',
    'dữ liệu', 'du lieu', 'data', 'import', 'ko', 'không'
  ];
  
  // Split question into words and filter
  const words = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(word => {
      const normalizedWord = word.toLowerCase();
      return word.length > 2 && !stopWords.includes(normalizedWord);
    });
  
  // Add meaningful words as search terms (but exclude if already in terms)
  words.forEach(word => {
    if (!terms.some(term => term.toLowerCase().includes(word) || word.includes(term.toLowerCase()))) {
      terms.push(word);
    }
  });
  
  // Extract all numbers (could be IDs, codes, etc.)
  const numberMatches = question.match(/\d+/g);
  if (numberMatches) {
    numberMatches.forEach(num => {
      if (!terms.includes(num)) {
        terms.push(num);
      }
    });
  }
  
  // Remove duplicates and empty strings
  const uniqueTerms = [...new Set(terms.filter(term => term && term.trim().length > 0))];
  
  // #region agent log
  console.log('🔍 extractTSMaySearchTerms:', {
    question: question.substring(0, 50),
    terms: uniqueTerms
  });
  // #endregion
  
  return uniqueTerms;
}

/**
 * Helper function: Check if question is asking for statistical calculations
 */
function isStatisticalCalculationQuestion(question) {
  if (!question || typeof question !== 'string') {
    return false;
  }
  
  const lowerQuestion = question.toLowerCase();
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Strong statistical keywords (clear calculation requests)
  const strongStatisticalKeywords = [
    'tinh do lech chuan', 'tính độ lệch chuẩn', 'do lech chuan', 'độ lệch chuẩn',
    'standard deviation', 'std dev', 'stddev',
    'tinh trung binh', 'tính trung bình', 'trung binh', 'trung bình', 'average', 'mean',
    'tinh trung vi', 'tính trung vị', 'trung vi', 'trung vị', 'median',
    'tinh phuong sai', 'tính phương sai', 'phuong sai', 'phương sai', 'variance',
    'tinh min', 'tính min', 'minimum',
    'tinh max', 'tính max', 'maximum',
    'tinh tong', 'tính tổng', 'tong', 'tổng', 'sum'
  ];
  
  // Weak statistical keywords (might be general questions)
  const weakStatisticalKeywords = [
    'tinh thong ke', 'tính thống kê', 'thong ke', 'thống kê', 'statistics', 'statistical',
    'tinh toan', 'tính toán', 'tinh', 'tính', 'calculate', 'calculation'
  ];
  
  // Check for strong keywords (always consider as calculation request)
  const hasStrongKeyword = strongStatisticalKeywords.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  
  // Check for weak keywords (need data context)
  const hasWeakKeyword = weakStatisticalKeywords.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  
  // Check if question mentions TSMay/Excel data
  const hasDataKeyword = /tsmay|ts may|excel|du lieu|dữ liệu|data|kva|po|io|pk75|uk75/i.test(question);
  
  // If has strong keyword, always consider as calculation (even without data keyword)
  // If has weak keyword, need data keyword to confirm
  const isCalculation = hasStrongKeyword || (hasWeakKeyword && hasDataKeyword);
  
  // #region agent log
  console.log('🔍 isStatisticalCalculationQuestion:', {
    question: question.substring(0, 50),
    hasStrongKeyword,
    hasWeakKeyword,
    hasDataKeyword,
    isCalculation
  });
  // #endregion
  
  return isCalculation;
}

/**
 * Helper function: Extract field name and calculation type from question
 */
function extractCalculationRequest(question) {
  if (!question || typeof question !== 'string') {
    return null;
  }
  
  const lowerQuestion = question.toLowerCase();
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Detect calculation type
  let calculationType = null;
  if (/do lech chuan|standard deviation|std dev|stddev/i.test(normalizedQuestion)) {
    calculationType = 'standardDeviation';
  } else if (/trung binh|average|mean/i.test(normalizedQuestion)) {
    calculationType = 'mean';
  } else if (/trung vi|median/i.test(normalizedQuestion)) {
    calculationType = 'median';
  } else if (/phuong sai|variance/i.test(normalizedQuestion)) {
    calculationType = 'variance';
  } else if (/min|minimum/i.test(normalizedQuestion) && !/max/i.test(normalizedQuestion)) {
    calculationType = 'min';
  } else if (/max|maximum/i.test(normalizedQuestion)) {
    calculationType = 'max';
  } else if (/tong|sum/i.test(normalizedQuestion)) {
    calculationType = 'sum';
  }
  
  // Extract field name (common TSMay fields)
  // Pattern 1: "của kVA trong TSMay" -> extract "kVA"
  // Pattern 2: "của Po (W)" -> extract "Po (W)"
  // Pattern 3: "tính độ lệch chuẩn của kVA" -> extract "kVA"
  // IMPORTANT: Exclude filter patterns (TBKT, LSX, SBB, Số máy) from field extraction
  
  // First, check if the question contains filter patterns to exclude them
  const hasFilterPattern = /(?:tbkt|lsx|sbb|số\s*máy|so\s*may)\s*\d+/i.test(question);
  
  const fieldPatterns = [
    // Pattern: "của [field] trong/..." - but exclude if it's a filter pattern
    /(?:của|of|cho|for)\s+([a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s()]+?)(?:\s+(?:trong|in|từ|from|với|with)|$)/i,
    // Pattern: "field [name]" or "trường [name]"
    /(?:field|trường|cột|column)\s+([a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s()]+?)(?:\s+(?:trong|in|từ|from)|$)/i
  ];
  
  let fieldName = null;
  for (const pattern of fieldPatterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      let extractedField = match[1].trim();
      // Remove "trong TSMay" if accidentally captured
      extractedField = extractedField.replace(/\s+trong\s+tsmay.*$/i, '').trim();
      
      // Skip if it's a filter pattern (TBKT, LSX, SBB, Số máy with numbers)
      if (hasFilterPattern && /(?:tbkt|lsx|sbb|số\s*máy|so\s*may)\s*\d+/i.test(extractedField)) {
        continue;
      }
      
      // Skip if it looks like a filter value (e.g., "20113B", "2081001453")
      if (/^\d{4,}[a-z]?$/i.test(extractedField)) {
        continue;
      }
      
      fieldName = extractedField;
      break;
    }
  }
  
  // If no field specified, try to detect common numeric fields in the question
  if (!fieldName) {
    const numericFields = [
      { pattern: /kva/i, name: 'kVA' },
      { pattern: /po\s*\(?\s*w\s*\)?/i, name: 'Po (W)' },
      { pattern: /io\s*\(?\s*%?\s*\)?/i, name: 'Io (%)' },
      { pattern: /pk75\s*\(?\s*w\s*\)?/i, name: 'Pk75 (W)' },
      { pattern: /uk75\s*\(?\s*%?\s*\)?/i, name: 'Uk75 (%)' },
      { pattern: /udm\s+hv|uđm\s+hv/i, name: 'Uđm HV' },
      { pattern: /lv/i, name: 'LV' },
      { pattern: /cong\s+suat|công\s+suất|power/i, name: 'kVA' }
    ];
    for (const field of numericFields) {
      if (field.pattern.test(question)) {
        fieldName = field.name;
        break;
      }
    }
  }
  
  // Extract filter conditions (e.g., "TBKT 20113B", "của TBKT 20113B")
  let filterField = null;
  let filterValue = null;
  
  // Pattern 1: "TBKT 20113B", "TBKT20113B", "mã TBKT 20113B"
  const tbktPattern = /(?:mã\s+)?tbkt\s*(\d{4,6}[a-z]?)/i;
  const tbktMatch = question.match(tbktPattern);
  if (tbktMatch) {
    filterField = 'TBKT';
    filterValue = tbktMatch[1].toUpperCase();
  }
  
  // Pattern 2: "LSX 2081001453", "LSX2081001453"
  const lsxPattern = /(?:mã\s+)?lsx\s*(\d{6,})/i;
  const lsxMatch = question.match(lsxPattern);
  if (lsxMatch) {
    filterField = 'LSX';
    filterValue = lsxMatch[1];
  }
  
  // Pattern 3: "SBB 2130478", "SBB2130478"
  const sbbPattern = /(?:mã\s+)?sbb\s*(\d{6,})/i;
  const sbbMatch = question.match(sbbPattern);
  if (sbbMatch) {
    filterField = 'SBB';
    filterValue = sbbMatch[1];
  }
  
  // Pattern 4: "Số máy 212250026", "Số máy212250026"
  const soMayPattern = /(?:số\s*máy|so\s*may)\s*(\d{6,})/i;
  const soMayMatch = question.match(soMayPattern);
  if (soMayMatch) {
    filterField = 'Số máy';
    filterValue = soMayMatch[1];
  }
  
  // Pattern 5: "KVA 250", "KVA250" (if not already extracted as fieldName)
  if (!filterField && !fieldName) {
    const kvaPattern = /(?:kva|kva\s*=|kva\s*là)\s*(\d+)/i;
    const kvaMatch = question.match(kvaPattern);
    if (kvaMatch) {
      filterField = 'KVA';
      filterValue = kvaMatch[1];
    }
  }
  
  return {
    type: calculationType,
    field: fieldName,
    filterField: filterField,
    filterValue: filterValue
  };
}

/**
 * Helper function: Calculate statistics from TSMay data
 */
async function calculateTSMayStatistics(question) {
  try {
    // #region agent log
    console.log('📊 calculateTSMayStatistics started:', {
      question: question.substring(0, 50)
    });
    // #endregion
    
    // Extract calculation request
    const calcRequest = extractCalculationRequest(question);
    if (!calcRequest || !calcRequest.type) {
      throw new Error('Không thể xác định loại tính toán từ câu hỏi.');
    }
    
    console.log('📊 Calculation request:', {
      type: calcRequest.type,
      field: calcRequest.field,
      filterField: calcRequest.filterField,
      filterValue: calcRequest.filterValue
    });
    
    // Try SQL Server first if configured
    if (sqlTSMayService && process.env.SQL_SERVER_HOST) {
      try {
        console.log('📊 Using SQL Server for statistics calculation...');
        const sqlResult = await sqlTSMayService.calculateStatistics(
          calcRequest.type,
          calcRequest.field,
          {
            filterField: calcRequest.filterField,
            filterValue: calcRequest.filterValue
          }
        );
        
        if (sqlResult && sqlResult.result !== null && sqlResult.result !== undefined) {
          return sqlResult.formattedResult;
        }
      } catch (sqlError) {
        console.warn('⚠️ SQL Server calculation failed, falling back to Firestore:', sqlError.message);
        // Fall through to Firestore calculation
      }
    }
    
    // Fallback to Firestore calculation
    // Get all TSMay data
    const tsMayRef = db.collection('TSMay');
    let query = tsMayRef;
    
    // Apply filter if specified
    if (calcRequest.filterField && calcRequest.filterValue) {
      // Try to find the field in documents first to determine the exact field name
      const sampleSnapshot = await tsMayRef.limit(1).get();
      if (!sampleSnapshot.empty) {
        const sampleDoc = sampleSnapshot.docs[0].data();
        const columnMapping = sampleDoc._columnMapping || {};
        const reverseMapping = {};
        Object.keys(columnMapping).forEach(originalName => {
          const sanitized = columnMapping[originalName];
          reverseMapping[sanitized] = originalName;
        });
        
        // Find the field key
        const fieldKey = Object.keys(sampleDoc).find(key => {
          if (key.startsWith('_')) return false;
          const originalName = reverseMapping[key] || key;
          return originalName.toLowerCase().includes(calcRequest.filterField.toLowerCase()) ||
                 calcRequest.filterField.toLowerCase().includes(originalName.toLowerCase());
        });
        
        if (fieldKey) {
          query = query.where(fieldKey, '==', calcRequest.filterValue);
        }
      }
    }
    
    const snapshot = await query.limit(1000).get(); // Get up to 1000 records
    
    if (snapshot.empty) {
      return 'Không tìm thấy dữ liệu nào trong collection TSMay để tính toán.';
    }
    
    // Convert documents to array
    const documents = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const columnMapping = data._columnMapping || {};
      const reverseMapping = {};
      Object.keys(columnMapping).forEach(originalName => {
        const sanitized = columnMapping[originalName];
        reverseMapping[sanitized] = originalName;
      });
      
      const cleanData = {};
      Object.keys(data).forEach(key => {
        if (!key.startsWith('_')) {
          const originalName = reverseMapping[key] || key;
          cleanData[originalName] = data[key];
        }
      });
      
      documents.push(cleanData);
    });
    
    // Find the field to calculate
    let fieldName = calcRequest.field;
    let fieldValues = [];
    
    if (fieldName) {
      // Try to find field (case-insensitive, with/without spaces)
      const fieldKey = Object.keys(documents[0] || {}).find(key => 
        key.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase().replace(/\s+/g, '') ||
        key.toLowerCase().includes(fieldName.toLowerCase()) ||
        fieldName.toLowerCase().includes(key.toLowerCase())
      );
      
      if (fieldKey) {
        fieldName = fieldKey;
        fieldValues = documents
          .map(doc => doc[fieldKey])
          .filter(val => val !== null && val !== undefined && val !== '')
          .map(val => {
            // Convert to number
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              // Remove non-numeric characters except decimal point and minus
              const numStr = val.replace(/[^\d.-]/g, '');
              const num = parseFloat(numStr);
              return isNaN(num) ? null : num;
            }
            return null;
          })
          .filter(val => val !== null);
      } else {
        return `Không tìm thấy field "${calcRequest.field}" trong dữ liệu TSMay. Các field có sẵn: ${Object.keys(documents[0] || {}).slice(0, 10).join(', ')}...`;
      }
    } else {
      // If no field specified, try to find numeric fields automatically
      // Priority fields (common TSMay numeric fields)
      const priorityFields = [
        'kVA', 'kva', 'Po (W)', 'Po', 'Io (%)', 'Io', 
        'Pk75 (W)', 'Pk75', 'Uk75 (%)', 'Uk75',
        'Uñm HV', 'Uđm HV', 'LV', 'Udm HV'
      ];
      
      const numericFields = [];
      if (documents.length > 0) {
        Object.keys(documents[0]).forEach(key => {
          const sampleValue = documents[0][key];
          if (typeof sampleValue === 'number' || 
              (typeof sampleValue === 'string' && !isNaN(parseFloat(sampleValue.replace(/[^\d.-]/g, ''))))) {
            numericFields.push(key);
          }
        });
      }
      
      if (numericFields.length === 0) {
        return 'Không tìm thấy field số nào trong dữ liệu TSMay để tính toán.';
      }
      
      // Try to find priority field first
      let foundPriorityField = null;
      for (const priorityField of priorityFields) {
        foundPriorityField = numericFields.find(field => 
          field.toLowerCase().replace(/\s+/g, '') === priorityField.toLowerCase().replace(/\s+/g, '') ||
          field.toLowerCase().includes(priorityField.toLowerCase()) ||
          priorityField.toLowerCase().includes(field.toLowerCase())
        );
        if (foundPriorityField) break;
      }
      
      // Use priority field if found, otherwise use first numeric field
      fieldName = foundPriorityField || numericFields[0];
      fieldValues = documents
        .map(doc => doc[fieldName])
        .filter(val => val !== null && val !== undefined && val !== '')
        .map(val => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const numStr = val.replace(/[^\d.-]/g, '');
            const num = parseFloat(numStr);
            return isNaN(num) ? null : num;
          }
          return null;
        })
        .filter(val => val !== null);
    }
    
    if (fieldValues.length === 0) {
      return `Không tìm thấy giá trị số hợp lệ nào trong field "${fieldName}" để tính toán.`;
    }
    
    // Perform calculation
    let result = null;
    let resultLabel = '';
    
    switch (calcRequest.type) {
      case 'mean':
        result = fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length;
        resultLabel = 'Trung bình';
        break;
      
      case 'median':
        const sorted = [...fieldValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        result = sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2 
          : sorted[mid];
        resultLabel = 'Trung vị';
        break;
      
      case 'standardDeviation':
        const mean = fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length;
        const variance = fieldValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fieldValues.length;
        result = Math.sqrt(variance);
        resultLabel = 'Độ lệch chuẩn';
        break;
      
      case 'variance':
        const mean2 = fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length;
        result = fieldValues.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / fieldValues.length;
        resultLabel = 'Phương sai';
        break;
      
      case 'min':
        result = Math.min(...fieldValues);
        resultLabel = 'Giá trị nhỏ nhất';
        break;
      
      case 'max':
        result = Math.max(...fieldValues);
        resultLabel = 'Giá trị lớn nhất';
        break;
      
      case 'sum':
        result = fieldValues.reduce((sum, val) => sum + val, 0);
        resultLabel = 'Tổng';
        break;
      
      default:
        throw new Error(`Loại tính toán "${calcRequest.type}" chưa được hỗ trợ.`);
    }
    
    // Format result
    const formattedResult = typeof result === 'number' && result % 1 !== 0 
      ? result.toFixed(4) 
      : result.toString();
    
    return `**Kết quả tính toán thống kê từ dữ liệu TSMay:**
    
**${resultLabel}** của field **"${fieldName}"**: **${formattedResult}**

**Thông tin:**
- Số lượng bản ghi đã sử dụng: ${fieldValues.length}
- Tổng số bản ghi trong TSMay: ${documents.length}
- Field được tính toán: "${fieldName}"

${calcRequest.type === 'standardDeviation' ? `
**Giải thích:** Độ lệch chuẩn cho biết mức độ phân tán của dữ liệu. Giá trị càng lớn, dữ liệu càng phân tán.` : ''}
${calcRequest.type === 'mean' ? `
**Giải thích:** Trung bình là giá trị trung bình cộng của tất cả các giá trị.` : ''}
${calcRequest.type === 'median' ? `
**Giải thích:** Trung vị là giá trị ở giữa khi sắp xếp dữ liệu theo thứ tự tăng dần.` : ''}`;
    
  } catch (error) {
    // #region agent log
    console.error('❌ Error calculating TSMay statistics:', {
      error: error.message,
      errorStack: error.stack?.substring(0, 500),
      question: question.substring(0, 100)
    });
    // #endregion
    
    // Return a user-friendly error message instead of throwing
    const errorMessage = error.message || 'Lỗi không xác định';
    return `**LỖI KHI TÍNH TOÁN THỐNG KÊ:**

Hệ thống đã cố gắng tính toán thống kê từ dữ liệu TSMay nhưng gặp lỗi: ${errorMessage}

**Các nguyên nhân có thể:**
- Dữ liệu TSMay chưa được import hoặc collection trống
- Field được yêu cầu không tồn tại trong dữ liệu
- Giá trị filter không đúng (ví dụ: TBKT không tồn tại)
- Dữ liệu không đủ để tính toán (cần ít nhất 1 giá trị số hợp lệ)

**Giải pháp:**
- Kiểm tra lại dữ liệu TSMay đã được import chưa
- Kiểm tra lại tên field và giá trị filter
- Thử lại với câu hỏi khác hoặc liên hệ bộ phận kỹ thuật để hỗ trợ`;
  }
}

/**
 * Helper function: Search Outlook emails using Microsoft Graph API
 */
async function searchOutlookEmails(question, accessToken) {
  try {
    // #region agent log
    console.log('🔍 searchOutlookEmails started:', {
      question: question.substring(0, 50),
      tokenLength: accessToken.length,
      tokenPrefix: accessToken.substring(0, 20) + '...'
    });
    // #endregion
    // Create Graph client with access token
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
    
    // First, check if user has a mailbox (try to get user info and mailbox settings)
    let userInfo = null;
    try {
      userInfo = await client.api('/me').get();
      // #region agent log
      console.log('👤 User info:', {
        userPrincipalName: userInfo.userPrincipalName,
        mail: userInfo.mail,
        displayName: userInfo.displayName,
        mailEnabled: userInfo.mail !== null && userInfo.mail !== undefined
      });
      // #endregion
      
      // Check if user has a mailbox
      // If mail is null, user is likely an external user (Gmail, etc.) without Exchange mailbox
      if (!userInfo.mail && userInfo.userPrincipalName && userInfo.userPrincipalName.includes('#EXT#')) {
        // #region agent log
        console.warn('⚠️ External user detected (no mailbox):', {
          userPrincipalName: userInfo.userPrincipalName,
          mail: userInfo.mail
        });
        // #endregion
        throw new Error(`Người dùng này là external user (Gmail/Google account) và không có Exchange mailbox. Microsoft Graph API chỉ hỗ trợ Microsoft 365 mailboxes. Vui lòng đăng nhập bằng Microsoft 365 account hoặc Outlook.com account.`);
      }
      
      // Check if user has a mailbox by trying to get mailbox settings
      try {
        const mailboxSettings = await client.api('/me/mailboxSettings').get();
        // #region agent log
        console.log('📬 Mailbox settings available:', {
          timeZone: mailboxSettings.timeZone,
          language: mailboxSettings.language
        });
        // #endregion
      } catch (mailboxSettingsError) {
        // #region agent log
        console.warn('⚠️ Could not get mailbox settings:', mailboxSettingsError.message);
        // #endregion
        // If mailbox settings fail, it might be on-premise or not enabled
        if (mailboxSettingsError.message && (
          mailboxSettingsError.message.includes('inactive') ||
          mailboxSettingsError.message.includes('soft-deleted') ||
          mailboxSettingsError.message.includes('on-premise') ||
          mailboxSettingsError.message.includes('MailboxNotEnabledForRESTAPI')
        )) {
          throw new Error(`Mailbox không khả dụng cho REST API. Có thể do:\n` +
            `1. Mailbox là on-premise Exchange (không hỗ trợ Graph API)\n` +
            `2. Mailbox chưa được kích hoạt cho REST API\n` +
            `3. Người dùng không có Microsoft 365 license\n` +
            `4. Mailbox bị soft-deleted hoặc inactive\n\n` +
            `Chi tiết: ${mailboxSettingsError.message}`);
        }
      }
    } catch (userError) {
      // #region agent log
      console.warn('⚠️ Could not get user info:', userError.message);
      // #endregion
      // If user info fails with on-premise error, throw immediately
      if (userError.message && (
        userError.message.includes('inactive') ||
        userError.message.includes('soft-deleted') ||
        userError.message.includes('on-premise') ||
        userError.message.includes('MailboxNotEnabledForRESTAPI')
      )) {
        throw userError;
      }
    }

    // Extract search keywords from question
    const searchTerms = extractSearchTerms(question);
    
    // Build filter query for date range if month/year mentioned
    let filterQuery = '';
    const monthMatch = question.match(/(tháng\s*)?(\d{1,2})/i);
    const yearMatch = question.match(/(năm\s*)?(20\d{2})/i);
    
    if (monthMatch || yearMatch) {
      const now = new Date();
      let startDate = new Date(now.getFullYear(), 0, 1); // Start of year
      let endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // End of year
      
      if (yearMatch) {
        const year = parseInt(yearMatch[2]);
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
      }
      
      if (monthMatch) {
        const month = parseInt(monthMatch[2]) - 1; // 0-based
        const year = yearMatch ? parseInt(yearMatch[2]) : now.getFullYear();
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0, 23, 59, 59);
      }
      
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      filterQuery = `receivedDateTime ge ${startDateStr} and receivedDateTime le ${endDateStr}`;
    }

    // Try to get emails from inbox first (more reliable for cloud mailboxes)
    // If that fails, fall back to /me/messages
    let emails = null;
    let emailRequest = null;
    
    // Try /me/mailFolders/inbox/messages first (works better for cloud mailboxes)
    try {
      emailRequest = client
        .api('/me/mailFolders/inbox/messages')
        .top(50)
        .orderby('receivedDateTime desc')
        .select('subject,from,receivedDateTime,bodyPreview,body,isRead');
      
      if (filterQuery) {
        emailRequest = emailRequest.filter(filterQuery);
      }
      
      // #region agent log
      console.log('📡 Trying /me/mailFolders/inbox/messages:', {
        filterQuery: filterQuery || 'none',
        searchTermsCount: searchTerms.length
      });
      // #endregion
      
      emails = await emailRequest.get();
      
      // #region agent log
      console.log('✅ Successfully got emails from inbox');
      // #endregion
    } catch (inboxError) {
      // #region agent log
      console.warn('⚠️ Failed to get emails from inbox, trying /me/messages:', inboxError.message);
      // #endregion
      
      // Fallback to /me/messages
      try {
        emailRequest = client
          .api('/me/messages')
          .top(50)
          .orderby('receivedDateTime desc')
          .select('subject,from,receivedDateTime,bodyPreview,body,isRead');
        
        if (filterQuery) {
          emailRequest = emailRequest.filter(filterQuery);
        }
        
        // #region agent log
        console.log('📡 Trying /me/messages as fallback');
        // #endregion
        
        emails = await emailRequest.get();
        
        // #region agent log
        console.log('✅ Successfully got emails from /me/messages');
        // #endregion
      } catch (messagesError) {
        // #region agent log
        console.error('❌ Both endpoints failed:', {
          inboxError: inboxError.message,
          messagesError: messagesError.message
        });
        // #endregion
        throw messagesError; // Throw the last error
      }
    }
    // #region agent log
    console.log('📡 Graph API response:', {
      hasEmails: !!emails,
      emailsCount: emails?.value?.length || 0,
      hasValue: !!emails?.value
    });
    // #endregion

    if (!emails || !emails.value || emails.value.length === 0) {
      // #region agent log
      console.log('⚠️ No emails found');
      // #endregion
      return null;
    }

    // Filter by keywords if provided
    let filteredEmails = emails.value;
    if (searchTerms.length > 0) {
      filteredEmails = emails.value.filter(email => {
        const subject = (email.subject || '').toLowerCase();
        const preview = (email.bodyPreview || '').toLowerCase();
        return searchTerms.some(term => 
          subject.includes(term.toLowerCase()) || 
          preview.includes(term.toLowerCase())
        );
      });
    }

    if (filteredEmails.length === 0) {
      return null;
    }

    // Format email results
    let emailContext = `Tìm thấy ${filteredEmails.length} email(s) liên quan:\n\n`;
    
    filteredEmails.slice(0, 10).forEach((email, index) => {
      const from = email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown';
      const subject = email.subject || '(Không có tiêu đề)';
      const date = new Date(email.receivedDateTime).toLocaleString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const preview = email.bodyPreview || email.body?.content?.substring(0, 200) || '';
      
      emailContext += `${index + 1}. **${subject}**\n`;
      emailContext += `   - Từ: ${from}\n`;
      emailContext += `   - Ngày: ${date}\n`;
      if (preview) {
        emailContext += `   - Nội dung: ${preview.substring(0, 150)}${preview.length > 150 ? '...' : ''}\n`;
      }
      emailContext += `\n`;
    });

    return emailContext;
  } catch (error) {
    // #region agent log
    console.error('❌ Error searching Outlook emails:', {
      error: error.message,
      errorCode: error.code,
      errorStatus: error.statusCode,
      errorBody: error.body || error.response?.data
    });
    // #endregion
    
    // Handle specific error cases
    const errorMessage = error.message || '';
    if (errorMessage.includes('inactive') || 
        errorMessage.includes('soft-deleted') ||
        errorMessage.includes('on-premise') ||
        errorMessage.includes('MailboxNotEnabledForRESTAPI')) {
      // This is a mailbox configuration issue, not a code issue
      throw new Error(`Mailbox không khả dụng cho REST API. Có thể do:\n` +
        `1. Mailbox là on-premise Exchange (không hỗ trợ Graph API)\n` +
        `2. Mailbox chưa được kích hoạt cho REST API\n` +
        `3. Người dùng không có Microsoft 365 license\n` +
        `4. Mailbox bị soft-deleted hoặc inactive\n\n` +
        `Chi tiết: ${errorMessage}`);
    }
    
    // For other errors, throw with original message
    throw error;
  }
}

/**
 * Helper function: Extract search terms from question
 */
function extractSearchTerms(question) {
  const lowerQuestion = question.toLowerCase();
  const terms = [];
  
  // Extract month/year if mentioned
  const monthMatch = lowerQuestion.match(/(tháng\s*)?(\d{1,2})/);
  const yearMatch = lowerQuestion.match(/(năm\s*)?(20\d{2})/);
  
  // Extract keywords
  const keywords = ['xin nghỉ', 'nghỉ phép', 'đơn xin', 'xin phép', 'nghỉ', 'phép'];
  keywords.forEach(keyword => {
    if (lowerQuestion.includes(keyword)) {
      terms.push(keyword);
    }
  });
  
  // Add month/year if found
  if (monthMatch) {
    terms.push(`tháng ${monthMatch[2]}`);
  }
  if (yearMatch) {
    terms.push(`năm ${yearMatch[2]}`);
  }
  
  return terms;
}

/**
 * Helper function: Check if question is related to OneDrive
 */
/**
 * Helper function: Check if question is about files/documents (smart detection)
 * This helps detect file-related questions even without "onedrive" keyword
 */
function isFileRelatedQuestionSmart(question) {
  if (!question || typeof question !== 'string') {
    return false;
  }
  const fileActionKeywords = [
    'liệt kê', 'liet ke', 'danh sách', 'danh sach', 'list', 'kể', 'ke',
    'tên file', 'ten file', 'file nào', 'file nao', 'file gì', 'file gi',
    'file pdf', 'file word', 'file excel', 'file docx', 'file xlsx',
    'tài liệu', 'tai lieu', 'document', 'tệp', 'tep'
  ];
  
  const fileTypeKeywords = [
    'pdf', 'word', 'excel', 'powerpoint', 'docx', 'xlsx', 'pptx', 
    'doc', 'xls', 'ppt', 'txt', 'spreadsheet', 'bảng tính'
  ];
  
  const lowerQuestion = question.toLowerCase();
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Check if question has file action keywords
  const hasFileAction = fileActionKeywords.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  
  // Check if question has file type keywords
  const hasFileType = fileTypeKeywords.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  
  // If question has both file action and file type, or just file action with "file" keyword
  const hasFileKeyword = normalizedQuestion.includes('file') || normalizedQuestion.includes('tai lieu');
  
  return (hasFileAction && (hasFileType || hasFileKeyword));
}

function isOneDriveRelatedQuestion(question) {
  if (!question || typeof question !== 'string') {
    return false;
  }
  const oneDriveKeywords = [
    'onedrive', 'one drive', 'drive', 'file', 'tài liệu', 'document',
    'tìm file', 'tìm tài liệu', 'file nào', 'tài liệu nào',
    'file mới', 'tài liệu mới', 'có file', 'có tài liệu',
    'folder', 'thư mục', 'word', 'excel', 'powerpoint', 'pdf',
    'docx', 'xlsx', 'pptx', 'xls', 'doc', 'tìm trong', 'trong drive',
    'tóm tắt', 'nội dung file', 'nội dung tài liệu', 'spreadsheet', 'bảng tính',
    'liệt kê', 'liet ke', 'danh sách', 'danh sach', 'list'
  ];
  let lowerQuestion = question.toLowerCase();
  
  // Fix common typos/missing characters before matching
  // "rong" (missing 't') → "trong"
  const typoFixes = {
    'rong': 'trong',
    'ong': 'trong',  // missing 'tr'
    'tron': 'trong', // missing 'g'
    'trog': 'trong'  // wrong character
  };
  
  // Apply typo fixes
  Object.entries(typoFixes).forEach(([typo, correct]) => {
    // Only replace if it's a standalone word (not part of another word)
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    lowerQuestion = lowerQuestion.replace(regex, correct);
  });
  
  // Normalize: remove diacritics for better matching
  const normalizedQuestion = lowerQuestion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const matchedKeywords = oneDriveKeywords.filter(k => {
    const normalizedKeyword = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedQuestion.includes(normalizedKeyword);
  });
  const isOneDrive = matchedKeywords.length > 0;
  // #region agent log
  console.log('🔍 isOneDriveRelatedQuestion:', {
    question: question.substring(0, 50),
    lowerQuestion: lowerQuestion.substring(0, 50),
    normalizedQuestion: normalizedQuestion.substring(0, 50),
    isOneDrive,
    matchedKeywords
  });
  // #endregion
  return isOneDrive;
}

/**
 * Helper function: Search OneDrive files using Microsoft Graph API
 */
async function searchOneDriveFiles(question, accessToken) {
  try {
    // #region agent log
    console.log('🔍 searchOneDriveFiles started:', {
      question: question.substring(0, 50),
      tokenLength: accessToken.length,
      tokenPrefix: accessToken.substring(0, 20) + '...'
    });
    // #endregion
    
    // Create Graph client with access token
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
    
    // Extract search keywords from question
    const searchTerms = extractOneDriveSearchTerms(question);
    
    // Search in OneDrive root and common folders
    let files = [];
    
    // Try to get files from OneDrive
    try {
      // First, try to get recent files (most relevant)
      try {
        const recentFiles = await client
          .api('/me/drive/recent')
          .top(50)
          .get();
        
        if (recentFiles && recentFiles.value) {
          files = recentFiles.value;
          // #region agent log
          console.log('✅ Got recent files:', files.length);
          // #endregion
        }
      } catch (recentError) {
        console.warn('⚠️ Could not get recent files, trying root:', recentError.message);
        
        // Fallback: Get files from root
        const rootFiles = await client
          .api('/me/drive/root/children')
          .top(50)
          .orderby('lastModifiedDateTime desc')
          .select('id,name,file,lastModifiedDateTime,webUrl,size')
          .get();
        
        if (rootFiles && rootFiles.value) {
          files = rootFiles.value;
          // #region agent log
          console.log('✅ Got root files:', files.length);
          // #endregion
        }
      }
      
      // If still no files, try searching in all drives
      if (files.length === 0) {
        try {
          const allFiles = await client
            .api('/me/drive/root/children')
            .top(100)
            .orderby('lastModifiedDateTime desc')
            .select('id,name,file,lastModifiedDateTime,webUrl,size')
            .get();
          
          if (allFiles && allFiles.value) {
            files = allFiles.value;
            // #region agent log
            console.log('✅ Got all root files:', files.length);
            // #endregion
          }
        } catch (allFilesError) {
          console.warn('⚠️ Could not get all files:', allFilesError.message);
        }
      }
    } catch (error) {
      console.error('❌ Error getting OneDrive files:', error.message);
      throw error;
    }
    
    // #region agent log
    console.log('📡 Graph API response:', {
      hasFiles: !!files,
      filesCount: files.length
    });
    // #endregion

    if (!files || files.length === 0) {
      // #region agent log
      console.log('⚠️ No files found');
      // #endregion
      return null;
    }

    // Filter by keywords if provided
    // Only filter if there are specific file-related keywords (not generic ones like "file", "onedrive", "drive")
    const genericKeywords = ['file', 'tài liệu', 'document', 'onedrive', 'one drive', 'drive', 'folder', 'thư mục'];
    // Also exclude common question words that shouldn't be used for filtering
    // Include common typos/missing characters: "rong" (missing 't' from "trong")
    const questionWords = ['những', 'nào', 'có', 'trong', 'rong', 'của', 'tôi', 'bạn', 'bao', 'nhiêu', 'gì', 'đâu', 'thế', 'nào'];
    const specificKeywords = searchTerms.filter(term => 
      !genericKeywords.includes(term.toLowerCase()) && 
      !questionWords.includes(term.toLowerCase())
    );
    
    // #region agent log
    console.log('🔍 Filter analysis:', {
      searchTerms,
      specificKeywords,
      filesCount: files.length,
      fileNames: files.map(f => f.name).slice(0, 5)
    });
    // #endregion
    
    let filteredFiles = files;
    
    // Check if specific keywords match file types (word, excel, pdf, etc.) rather than just filenames
    const fileTypeKeywords = {
      'word': ['.docx', '.doc'],
      'excel': ['.xlsx', '.xls'],
      'pdf': ['.pdf'],
      'powerpoint': ['.pptx', '.ppt'],
      'text': ['.txt']
    };
    
    const typeKeywords = specificKeywords.filter(term => 
      Object.keys(fileTypeKeywords).includes(term.toLowerCase())
    );
    
    // #region agent log
    console.log('🔍 Type keywords check:', {
      typeKeywords,
      hasTypeKeywords: typeKeywords.length > 0,
      specificKeywordsAfterFilter: specificKeywords
    });
    // #endregion
    
    if (typeKeywords.length > 0) {
      // Filter by file type/extension
      const matchingExtensions = typeKeywords.flatMap(keyword => 
        fileTypeKeywords[keyword.toLowerCase()] || []
      );
      // #region agent log
      console.log('🔍 Filtering by file type:', {
        typeKeywords,
        matchingExtensions,
        originalCount: files.length
      });
      // #endregion
      filteredFiles = files.filter(file => {
        const fileName = (file.name || '').toLowerCase();
        const matches = matchingExtensions.some(ext => fileName.endsWith(ext));
        // #region agent log
        if (!matches && files.length <= 5) {
          console.log(`   File "${file.name}" does NOT match extensions: ${matchingExtensions.join(', ')}`);
        }
        // #endregion
        return matches;
      });
      // #region agent log
      console.log('✅ Filtered by type result:', {
        filteredCount: filteredFiles.length,
        filteredFileNames: filteredFiles.map(f => f.name)
      });
      // #endregion
    } else if (specificKeywords.length > 0) {
      // Only filter if there are specific keywords (like file name, extension, etc.)
      // But skip if keywords are too generic or are question words
      // #region agent log
      console.log('🔍 Filtering by specific keywords (filename):', {
        specificKeywords,
        originalCount: files.length
      });
      // #endregion
      filteredFiles = files.filter(file => {
        const fileName = (file.name || '').toLowerCase();
        return specificKeywords.some(term => 
          fileName.includes(term.toLowerCase())
        );
      });
      // #region agent log
      console.log('✅ Filtered by keywords result:', {
        filteredCount: filteredFiles.length,
        filteredFileNames: filteredFiles.map(f => f.name)
      });
      // #endregion
    } else {
      // No specific keywords (only generic/question words) - show all files
      // #region agent log
      console.log('📋 No specific keywords (only generic/question words), showing all files:', {
        filesCount: files.length,
        searchTerms,
        specificKeywords
      });
      // #endregion
    }

    if (filteredFiles.length === 0) {
      // #region agent log
      console.log('⚠️ No files match search criteria:', {
        filesCount: files.length,
        filteredCount: filteredFiles.length,
        searchTerms,
        specificKeywords,
        typeKeywords,
        allFileNames: files.map(f => f.name)
      });
      // #endregion
      
      // If filtering by type and no match, still show available files with a helpful message
      if (typeKeywords.length > 0 && files.length > 0) {
        const requestedType = typeKeywords[0];
        const availableFileTypes = files.map(f => {
          const ext = (f.name || '').split('.').pop()?.toLowerCase() || 'unknown';
          return ext;
        });
        
        let context = `Không tìm thấy file ${requestedType} trong OneDrive.\n\n`;
        context += `Các file có sẵn trong OneDrive:\n\n`;
        
        files.slice(0, 10).forEach((file, index) => {
          const fileName = file.name || '(Không có tên)';
          let fileType = file.file?.mimeType || 'unknown';
          if (fileType === 'unknown' && fileName) {
            const ext = fileName.split('.').pop()?.toLowerCase();
            const mimeTypes = {
              'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'doc': 'application/msword',
              'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'xls': 'application/vnd.ms-excel',
              'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'ppt': 'application/vnd.ms-powerpoint',
              'pdf': 'application/pdf',
              'txt': 'text/plain'
            };
            if (ext && mimeTypes[ext]) {
              fileType = mimeTypes[ext];
            }
          }
          const fileSize = file.size ? formatFileSize(file.size) : 'unknown';
          const lastModified = file.lastModifiedDateTime 
            ? new Date(file.lastModifiedDateTime).toLocaleString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'unknown';
          
          context += `${index + 1}. **${fileName}**\n`;
          context += `   - Loại: ${fileType}\n`;
          context += `   - Kích thước: ${fileSize}\n`;
          context += `   - Sửa đổi lần cuối: ${lastModified}\n\n`;
        });
        
        // #region agent log
        console.log('✅ Returning context with available files (no match):', {
          requestedType,
          availableFilesCount: files.length,
          contextLength: context.length
        });
        // #endregion
        
        return context;
      }
      
      // If no files at all, return null
      return null;
    }

    // Limit to top 10 files for context
    const topFiles = filteredFiles.slice(0, 10);
    
    // Format file results and summarize if needed
    let oneDriveContext = `Tìm thấy ${filteredFiles.length} file(s) trong OneDrive:\n\n`;
    
    // Check if user wants summary
    const wantsSummary = question.toLowerCase().includes('tóm tắt') || 
                        question.toLowerCase().includes('nội dung') ||
                        question.toLowerCase().includes('summary');
    
    for (let i = 0; i < topFiles.length; i++) {
      const file = topFiles[i];
      const fileName = file.name || '(Không có tên)';
      // Get mimeType from file object or infer from file extension
      let fileType = file.file?.mimeType || file.file?.mimeType || 'unknown';
      if ((!fileType || fileType === 'unknown') && fileName) {
        // Infer mimeType from extension
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'doc': 'application/msword',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'xls': 'application/vnd.ms-excel',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'ppt': 'application/vnd.ms-powerpoint',
          'pdf': 'application/pdf',
          'txt': 'text/plain'
        };
        if (ext && mimeTypes[ext]) {
          fileType = mimeTypes[ext];
        }
      }
      const fileSize = file.size ? formatFileSize(file.size) : 'unknown';
      const lastModified = file.lastModifiedDateTime 
        ? new Date(file.lastModifiedDateTime).toLocaleString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'unknown';
      
      oneDriveContext += `${i + 1}. **${fileName}**\n`;
      oneDriveContext += `   - Loại: ${fileType}\n`;
      oneDriveContext += `   - Kích thước: ${fileSize}\n`;
      oneDriveContext += `   - Sửa đổi lần cuối: ${lastModified}\n`;
      
      // If user wants summary and file is readable (Word, Excel, PDF, text), try to summarize
      if (wantsSummary && file.id && (
        fileType.includes('word') || 
        fileType.includes('document') ||
        fileType.includes('excel') ||
        fileType.includes('spreadsheet') ||
        fileType.includes('pdf') || 
        fileType.includes('text') ||
        fileName.endsWith('.docx') ||
        fileName.endsWith('.doc') ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls') ||
        fileName.endsWith('.pdf') ||
        fileName.endsWith('.txt')
      )) {
        try {
          const summary = await summarizeOneDriveFile(file.id, accessToken, fileType, fileName);
          if (summary) {
            // Truncate summary if too long for display
            const displaySummary = summary.length > 300 ? summary.substring(0, 300) + '...' : summary;
            oneDriveContext += `   - Tóm tắt: ${displaySummary}\n`;
          }
        } catch (summaryError) {
          console.warn('⚠️ Could not summarize file:', summaryError.message);
          // Continue without summary
        }
      }
      
      oneDriveContext += `\n`;
    }

    return oneDriveContext;
  } catch (error) {
    // #region agent log
    console.error('❌ Error searching OneDrive files:', {
      error: error.message,
      errorCode: error.code,
      errorStatus: error.statusCode,
      errorBody: error.body || error.response?.data
    });
    // #endregion
    
    // Handle specific error cases
    const errorMessage = error.message || '';
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      throw new Error(`Không có quyền truy cập OneDrive. Vui lòng đảm bảo đã cấp quyền Files.Read và Files.Read.All trong Azure AD.`);
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      throw new Error(`Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.`);
    }
    
    // For other errors, throw with original message
    throw error;
  }
}

/**
 * Helper function: Summarize OneDrive file content using Gemini API
 * Supports: Text, Word (.docx), Excel (.xlsx), PDF
 */
async function summarizeOneDriveFile(fileId, accessToken, fileType, fileName = '') {
  try {
    // #region agent log
    console.log('📄 Starting file summarization:', {
      fileId: fileId.substring(0, 20) + '...',
      fileType,
      fileName: fileName.substring(0, 50)
    });
    // #endregion
    
    // Download file content from OneDrive
    let fileBuffer = null;
    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      
      // Get file as buffer (binary data)
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      
      // #region agent log
      console.log('✅ File downloaded:', {
        size: fileBuffer.length,
        fileType
      });
      // #endregion
    } catch (downloadError) {
      console.error('❌ Error downloading file:', downloadError.message);
      return null;
    }
    
    let content = '';
    let extractedText = '';
    
    // Parse file content based on type
    try {
      if (fileType.includes('text') || fileType.includes('plain') || fileName.endsWith('.txt')) {
        // Plain text file
        content = fileBuffer.toString('utf-8');
        extractedText = content;
        
      } else if (fileType.includes('word') || fileType.includes('document') || 
                 fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        // Word document (.docx) - use mammoth to extract text
        try {
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          extractedText = result.value;
          
          // Also get HTML for better formatting (optional)
          const htmlResult = await mammoth.convertToHtml({ buffer: fileBuffer });
          content = htmlResult.value; // HTML content
          
          // #region agent log
          console.log('✅ Word document parsed:', {
            textLength: extractedText.length,
            htmlLength: content.length
          });
          // #endregion
        } catch (wordError) {
          console.error('❌ Error parsing Word document:', wordError.message);
          return 'Không thể đọc nội dung file Word. File có thể bị lỗi hoặc không hỗ trợ.';
        }
        
      } else if (fileType.includes('excel') || fileType.includes('spreadsheet') || 
                 fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel file (.xlsx, .xls) - use xlsx library
        try {
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
          
          // Extract text from all sheets
          const sheetTexts = [];
          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            // Convert sheet data to readable text
            let sheetText = `Sheet: ${sheetName}\n`;
            sheetData.forEach((row, rowIndex) => {
              if (Array.isArray(row) && row.some(cell => cell !== '')) {
                const rowText = row.filter(cell => cell !== '').join(' | ');
                if (rowText.trim()) {
                  sheetText += `Row ${rowIndex + 1}: ${rowText}\n`;
                }
              }
            });
            sheetTexts.push(sheetText);
          });
          
          extractedText = sheetTexts.join('\n\n');
          content = extractedText;
          
          // #region agent log
          console.log('✅ Excel file parsed:', {
            sheetsCount: workbook.SheetNames.length,
            textLength: extractedText.length
          });
          // #endregion
        } catch (excelError) {
          console.error('❌ Error parsing Excel file:', excelError.message);
          return 'Không thể đọc nội dung file Excel. File có thể bị lỗi hoặc không hỗ trợ.';
        }
        
      } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
        // PDF file - use pdf-parse
        try {
          const pdfData = await pdfParse(fileBuffer);
          extractedText = pdfData.text;
          content = extractedText;
          
          // #region agent log
          console.log('✅ PDF file parsed:', {
            pages: pdfData.numpages,
            textLength: extractedText.length,
            info: pdfData.info
          });
          // #endregion
        } catch (pdfError) {
          console.error('❌ Error parsing PDF file:', pdfError.message);
          return 'Không thể đọc nội dung file PDF. File có thể bị mã hóa hoặc không hỗ trợ.';
        }
        
      } else {
        // Unsupported file type
        return null;
      }
    } catch (parseError) {
      console.error('❌ Error parsing file:', parseError.message);
      return 'Không thể đọc nội dung file. File có thể không hỗ trợ hoặc bị lỗi.';
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      return 'File không có nội dung text để tóm tắt.';
    }
    
    // Limit content length for summarization (first 10000 chars for better context)
    const contentToSummarize = extractedText.substring(0, 10000);
    
    // Use Gemini API to create smart summary
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && contentToSummarize.length > 50) {
      try {
        // Create a smart summary prompt
        const summaryPrompt = `Hãy tóm tắt ngắn gọn và thông minh nội dung sau đây. 
Tóm tắt phải:
- Ngắn gọn (tối đa 200 từ)
- Bằng tiếng Việt
- Nêu rõ các điểm chính
- Dễ hiểu và có cấu trúc

Nội dung:\n\n${contentToSummarize}${extractedText.length > 10000 ? '\n\n(Lưu ý: Đây chỉ là phần đầu của file, file có thể dài hơn)' : ''}`;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: summaryPrompt }]
            }]
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
            const summary = result.candidates[0].content.parts[0].text;
            // #region agent log
            console.log('✅ Summary generated by Gemini:', {
              summaryLength: summary.length
            });
            // #endregion
            return summary;
          }
        } else {
          const errorText = await response.text();
          console.warn('⚠️ Gemini API error:', response.status, errorText);
        }
      } catch (geminiError) {
        console.warn('⚠️ Could not use Gemini for summary:', geminiError.message);
        // Fallback to simple preview
      }
    }
    
    // Fallback: return a simple preview if Gemini is not available
    const preview = extractedText.substring(0, 500).trim();
    return preview + (extractedText.length > 500 ? '...' : '');
    
  } catch (error) {
    console.error('❌ Error summarizing file:', error.message);
    console.error('Error stack:', error.stack);
    return null;
  }
}

/**
 * Helper function: Extract search terms from OneDrive question
 */
function extractOneDriveSearchTerms(question) {
  let lowerQuestion = question.toLowerCase();
  
  // Fix common typos/missing characters before extraction
  // "rong" (missing 't') → "trong"
  const typoFixes = {
    'rong': 'trong',
    'ong': 'trong',  // missing 'tr'
    'tron': 'trong', // missing 'g'
    'trog': 'trong'  // wrong character
  };
  
  // Apply typo fixes (only replace standalone words)
  Object.entries(typoFixes).forEach(([typo, correct]) => {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    lowerQuestion = lowerQuestion.replace(regex, correct);
  });
  
  const terms = [];
  
  // Common file extensions
  const extensions = ['.docx', '.xlsx', '.pptx', '.pdf', '.txt', '.doc', '.xls', '.ppt'];
  extensions.forEach(ext => {
    if (lowerQuestion.includes(ext)) {
      terms.push(ext.replace('.', ''));
    }
  });
  
  // Common keywords
  const keywords = ['word', 'excel', 'powerpoint', 'pdf', 'document', 'tài liệu', 'file', 'spreadsheet', 'bảng tính'];
  keywords.forEach(keyword => {
    if (lowerQuestion.includes(keyword)) {
      terms.push(keyword);
    }
  });
  
  // Extract specific file names or terms (simple extraction)
  // Remove common Vietnamese stop words (including fixed "trong")
  const stopWords = ['tìm', 'file', 'tài liệu', 'trong', 'rong', 'onedrive', 'drive', 'của', 'tôi', 'cho', 'về'];
  const words = lowerQuestion.split(/\s+/).filter(word => {
    return word.length > 2 && !stopWords.includes(word);
  });
  
  // Add meaningful words as search terms
  words.forEach(word => {
    if (word.length > 2 && !terms.includes(word)) {
      terms.push(word);
    }
  });
  
  return terms;
}

/**
 * Helper function: Format file size
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Health check function
 */
exports.healthCheck = onRequest(
  {
    cors: true,
  },
  (req, res) => {
    cors(req, res, () => {
      return res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "THITHI AI Chat Function",
      });
    });
  }
);

// ============================================
// TELEGRAM MINI APP AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Utility: Normalize phone number (remove +84, spaces, etc.)
 * Input: "+84901234567" or "0901234567" or "84 901 234 567"
 * Output: "0901234567"
 */
function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');
  // Remove country code +84 if present
  if (normalized.startsWith('84')) {
    normalized = normalized.substring(2);
  }
  // Remove leading 0 if present (should keep it for Vietnam format)
  // Return as is (should be 10 digits starting with 0)
  return normalized;
}

/**
 * Utility: Verify Telegram initData signature
 * Telegram sends initData as URL-encoded string with hash parameter
 * We need to verify the hash using HMAC-SHA-256 with bot token as secret
 */
function verifyTelegramInitData(initData, botToken) {
  try {
    if (!initData || !botToken) {
      return { valid: false, error: 'Missing initData or botToken' };
    }

    // Parse initData (URL-encoded string)
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return { valid: false, error: 'Missing hash in initData' };
    }

    // Remove hash from params and sort remaining params
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate HMAC-SHA-256
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Compare hashes (constant-time comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(calculatedHash, 'hex')
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Check auth_date (should be within last 24 hours)
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 24 * 60 * 60; // 24 hours
      
      if (now - authTimestamp > maxAge) {
        return { valid: false, error: 'initData expired' };
      }
    }

    // Extract user data
    const userStr = params.get('user');
    let user = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        return { valid: false, error: 'Invalid user data' };
      }
    }

    return {
      valid: true,
      user: user,
      authDate: authDate ? parseInt(authDate, 10) : null,
      queryId: params.get('query_id'),
      hash: hash
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Onboarding Endpoint (for Telegram Bot)
 * Links phone number to telegramId in employees collection
 * 
 * Request body:
 * {
 *   "phoneNumber": "0901234567",
 *   "telegramId": "123456789"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "employee": { ... }
 * }
 */
exports.telegramOnboarding = onRequest(
  {
    cors: true,
    maxInstances: 10,
    secrets: ["TELEGRAM_BOT_TOKEN"], // Optional: for additional verification
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method Not Allowed",
            message: "Only POST method is allowed",
          });
        }

        const { phoneNumber, telegramId } = req.body;

        // Validate input
        if (!phoneNumber || typeof phoneNumber !== 'string') {
          return res.status(400).json({
            error: "Bad Request",
            message: "phoneNumber is required and must be a string",
          });
        }

        if (!telegramId || typeof telegramId !== 'string') {
          return res.status(400).json({
            error: "Bad Request",
            message: "telegramId is required and must be a string",
          });
        }

        // Normalize phone number
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (!normalizedPhone || normalizedPhone.length < 10) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Invalid phone number format",
          });
        }

        // Check if employee exists with this phone number
        const employeesRef = db.collection('employees');
        const snapshot = await employeesRef
          .where('phoneNumber', '==', normalizedPhone)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (snapshot.empty) {
          return res.status(404).json({
            error: "Not Found",
            message: "Employee not found with this phone number or not active",
          });
        }

        const employeeDoc = snapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Check if already linked to another telegramId
        if (employeeData.telegramId && employeeData.telegramId !== telegramId && employeeData.isLinked) {
          return res.status(409).json({
            error: "Conflict",
            message: "This phone number is already linked to another Telegram account",
          });
        }

        // Update employee record
        await employeeDoc.ref.update({
          telegramId: telegramId,
          isLinked: true,
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Return success
        return res.status(200).json({
          success: true,
          message: "Phone number linked successfully",
          employee: {
            id: employeeDoc.id,
            phoneNumber: normalizedPhone,
            fullName: employeeData.fullName,
            role: employeeData.role,
            telegramId: telegramId,
            isLinked: true,
          },
        });
      } catch (error) {
        console.error("Error in telegramOnboarding:", error);
        return res.status(500).json({
          error: "Internal Server Error",
          message: error.message || "An unexpected error occurred",
        });
      }
    });
  }
);

/**
 * Login Endpoint (for Telegram Mini App)
 * Verifies Telegram initData and returns Firebase Custom Token
 * 
 * Request body:
 * {
 *   "initData": "query_id=...&user=...&auth_date=...&hash=..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "customToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "employee": { ... }
 * }
 */
/**
 * Cloud Function: Generate embeddings for TSMay documents
 * This function can be called to generate embeddings for existing documents
 * or to update embeddings for documents that don't have them yet
 */
exports.generateTSMayEmbeddings = onRequest(
  {
    cors: true,
    maxInstances: 5
  },
  async (req, res) => {
    // Handle CORS preflight
    cors(req, res, async () => {
      try {
        // Check authentication (optional, can be removed if you want public access)
        // const authHeader = req.headers.authorization;
        // if (!authHeader) {
        //   return res.status(401).json({ error: 'Unauthorized' });
        // }

        const { limit = 100, batchSize = 10 } = req.body || {};
        
        console.log('🔄 Starting to generate embeddings for TSMay documents...', {
          limit,
          batchSize
        });

        // Get TSMay collection
        const tsMayRef = db.collection('TSMay');
        
        // Get documents without embeddings or with old embeddings
        const snapshot = await tsMayRef
          .where('_embedding', '==', null) // Documents without embeddings
          .limit(limit)
          .get();

        if (snapshot.empty) {
          // Try to get any documents to check if they need updating
          const allSnapshot = await tsMayRef.limit(limit).get();
          if (allSnapshot.empty) {
            return res.status(200).json({
              success: true,
              message: 'No TSMay documents found',
              processed: 0
            });
          }
          
          // Process documents that might need embedding update
          const documents = [];
          allSnapshot.forEach(doc => {
            const data = doc.data();
            if (!data._embedding || !Array.isArray(data._embedding)) {
              documents.push({ id: doc.id, data });
            }
          });
          
          if (documents.length === 0) {
            return res.status(200).json({
              success: true,
              message: 'All documents already have embeddings',
              processed: 0
            });
          }
          
          return await processEmbeddingsBatch(documents, batchSize, res);
        }

        // Process documents without embeddings
        const documents = [];
        snapshot.forEach(doc => {
          documents.push({ id: doc.id, data: doc.data() });
        });

        await processEmbeddingsBatch(documents, batchSize, res);
      } catch (error) {
        console.error('❌ Error generating embeddings:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: error.message
        });
      }
    });
  }
);

/**
 * Helper function: Process embeddings in batches
 */
async function processEmbeddingsBatch(documents, batchSize, res) {
  let processed = 0;
  let errors = 0;
  const errorsList = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    
    console.log(`📊 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}...`);

    await Promise.all(batch.map(async (docItem) => {
      try {
        const { id, data } = docItem;
        
        // Create text representation for embedding
        const docText = createDocumentText({
          _originalData: data._originalData || data,
          ...data
        });

        if (!docText || docText.trim().length === 0) {
          console.warn(`⚠️ Skipping document ${id}: empty text`);
          return;
        }

        // Generate embedding
        const embedding = await generateEmbedding(docText);
        
        // Update document with embedding
        await db.collection('TSMay').doc(id).update({
          _embedding: embedding,
          _embeddingGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        processed++;
        console.log(`✅ Generated embedding for document ${id} (${processed}/${documents.length})`);
      } catch (error) {
        errors++;
        const errorMsg = `Document ${docItem.id}: ${error.message}`;
        errorsList.push(errorMsg);
        console.error(`❌ Error processing document ${docItem.id}:`, error);
      }
    }));

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < documents.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  res.status(200).json({
    success: true,
    message: `Processed ${processed} documents, ${errors} errors`,
    processed,
    errors,
    errorsList: errorsList.slice(0, 10) // Return first 10 errors
  });
}

/**
 * Cloud Function: Generate embedding for a single TSMay document
 * Can be called after importing a document to generate its embedding
 */
exports.generateTSMayDocumentEmbedding = onRequest(
  {
    cors: true,
    maxInstances: 10
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        const { documentId } = req.body || req.query;
        
        if (!documentId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'documentId is required'
          });
        }

        console.log(`🔄 Generating embedding for document ${documentId}...`);

        // Get document
        const docRef = db.collection('TSMay').doc(documentId);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({
            error: 'Not Found',
            message: `Document ${documentId} not found`
          });
        }

        const data = doc.data();
        
        // Create text representation for embedding
        const docText = createDocumentText({
          _originalData: data._originalData || data,
          ...data
        });

        if (!docText || docText.trim().length === 0) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Document has no text content to embed'
          });
        }

        // Generate embedding
        const embedding = await generateEmbedding(docText);
        
        // Update document with embedding
        await docRef.update({
          _embedding: embedding,
          _embeddingGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Generated embedding for document ${documentId}`);

        res.status(200).json({
          success: true,
          message: 'Embedding generated successfully',
          documentId,
          embeddingLength: embedding.length
        });
      } catch (error) {
        console.error('❌ Error generating embedding:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: error.message
        });
      }
    });
  }
);

exports.telegramLogin = onRequest(
  {
    cors: true,
    maxInstances: 10,
    secrets: ["TELEGRAM_BOT_TOKEN"], // Required for signature verification
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method Not Allowed",
            message: "Only POST method is allowed",
          });
        }

        const { initData } = req.body;

        // Validate input
        if (!initData || typeof initData !== 'string') {
          return res.status(400).json({
            error: "Bad Request",
            message: "initData is required and must be a string",
          });
        }

        // Get bot token from secrets
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.error("TELEGRAM_BOT_TOKEN secret not configured");
          return res.status(500).json({
            error: "Internal Server Error",
            message: "Telegram bot token not configured",
          });
        }

        // Verify Telegram initData signature
        const verification = verifyTelegramInitData(initData, botToken);
        if (!verification.valid) {
          return res.status(401).json({
            error: "Unauthorized",
            message: verification.error || "Invalid Telegram initData",
          });
        }

        const telegramUser = verification.user;
        if (!telegramUser || !telegramUser.id) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Telegram user data not found in initData",
          });
        }

        const telegramId = String(telegramUser.id);

        // Check if employee exists with this telegramId and is linked
        const employeesRef = db.collection('employees');
        const snapshot = await employeesRef
          .where('telegramId', '==', telegramId)
          .where('isLinked', '==', true)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (snapshot.empty) {
          return res.status(403).json({
            error: "Forbidden",
            message: "Telegram account not linked to any employee or employee not active",
          });
        }

        const employeeDoc = snapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Create or get Firebase user
        let firebaseUser;
        const firebaseUid = `telegram_${telegramId}`;
        
        try {
          // Try to get existing user
          firebaseUser = await auth.getUser(firebaseUid);
        } catch (error) {
          // User doesn't exist, create new one
          if (error.code === 'auth/user-not-found') {
            firebaseUser = await auth.createUser({
              uid: firebaseUid,
              displayName: employeeData.fullName || telegramUser.first_name || 'Employee',
              phoneNumber: employeeData.phoneNumber ? `+84${employeeData.phoneNumber.substring(1)}` : null,
              // Store telegramId as custom claim for easy access
              customClaims: {
                telegramId: telegramId,
                employeeId: employeeDoc.id,
                role: employeeData.role || 'employee',
              },
            });
          } else {
            throw error;
          }
        }

        // Update custom claims if needed
        if (firebaseUser.customClaims?.employeeId !== employeeDoc.id) {
          await auth.setCustomUserClaims(firebaseUser.uid, {
            telegramId: telegramId,
            employeeId: employeeDoc.id,
            role: employeeData.role || 'employee',
          });
        }

        // Generate Firebase Custom Token
        const customToken = await auth.createCustomToken(firebaseUser.uid, {
          telegramId: telegramId,
          employeeId: employeeDoc.id,
          role: employeeData.role || 'employee',
        });

        // Return success with custom token
        return res.status(200).json({
          success: true,
          customToken: customToken,
          employee: {
            id: employeeDoc.id,
            phoneNumber: employeeData.phoneNumber,
            fullName: employeeData.fullName,
            role: employeeData.role,
            telegramId: telegramId,
          },
        });
      } catch (error) {
        console.error("Error in telegramLogin:", error);
        return res.status(500).json({
          error: "Internal Server Error",
          message: error.message || "An unexpected error occurred",
        });
      }
    });
  }
);

// ============================================
// RAG System Endpoints
// ============================================

// Load RAG service
let ragService = null;
try {
  ragService = require('./rag-service');
  console.log('✅ RAG service loaded');
} catch (error) {
  console.warn('⚠️ RAG service not available:', error.message);
}

/**
 * RAG Ingest Endpoint - Ingest PDF files into SQL Server with vector embeddings
 * POST /ragIngest
 * Body: { file: base64 encoded PDF, fileName: string }
 */
exports.ragIngest = onRequest(
  {
    cors: true,
    maxInstances: 5,
    secrets: [
      "GEMINI_API_KEY",
      "SQL_SERVER_HOST",
      "SQL_SERVER_USER",
      "SQL_SERVER_PASSWORD",
      "SQL_SERVER_DATABASE",
      "SQL_SERVER_PORT"
    ],
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method Not Allowed",
            message: "Only POST method is allowed",
          });
        }

        if (!ragService) {
          return res.status(503).json({
            error: "Service Unavailable",
            message: "RAG service is not available. Please check server logs.",
          });
        }

        // Check SQL Server connection
        if (!sqlConnection || !process.env.SQL_SERVER_HOST) {
          return res.status(503).json({
            error: "Service Unavailable",
            message: "SQL Server is not configured. Please set SQL_SERVER_HOST secret.",
          });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          return res.status(500).json({
            error: "Configuration Error",
            message: "GEMINI_API_KEY is not configured. Please set it in Firebase Secrets.",
          });
        }

        // Get PDF file from request
        const {file, fileName} = req.body;
        
        if (!file) {
          return res.status(400).json({
            error: "Bad Request",
            message: "PDF file is required. Send file as base64 encoded string in 'file' field.",
          });
        }

        if (!fileName) {
          return res.status(400).json({
            error: "Bad Request",
            message: "File name is required in 'fileName' field.",
          });
        }

        // Decode base64 PDF
        let pdfBuffer;
        try {
          pdfBuffer = Buffer.from(file, 'base64');
        } catch (error) {
          return res.status(400).json({
            error: "Invalid File Format",
            message: "File must be base64 encoded. Error: " + error.message,
          });
        }

        // Ensure SQL pool is initialized
        const pool = sqlConnection.getSQLPool();
        if (!pool) {
          // Try to initialize
          const sqlConfig = {
            server: process.env.SQL_SERVER_HOST,
            database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI',
            port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
            encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false',
            trustServerCertificate: true,
          };

          if (process.env.SQL_SERVER_USER) {
            sqlConfig.user = process.env.SQL_SERVER_USER;
          }
          if (process.env.SQL_SERVER_PASSWORD) {
            sqlConfig.password = process.env.SQL_SERVER_PASSWORD;
          }

          await sqlConnection.initializeSQLPool(sqlConfig);
        }

        // Ingest PDF
        console.log(`📥 Ingesting PDF: ${fileName}`);
        const result = await ragService.ingestPDF(
          pdfBuffer,
          fileName,
          geminiApiKey,
          'rag_documents' // table name
        );

        return res.status(200).json({
          status: "success",
          message: `Đã ingest thành công ${result.totalChunks} chunks từ ${result.totalPages} trang`,
          data: result,
        });
      } catch (error) {
        console.error("Error in ragIngest:", error);
        return res.status(500).json({
          error: "Internal Server Error",
          message: error.message || "An unexpected error occurred",
        });
      }
    });
  }
);

/**
 * RAG Chat Endpoint - Chat with RAG system using semantic search
 * POST /ragChat
 * Body: { query: string, topK?: number }
 */
exports.ragChat = onRequest(
  {
    cors: true,
    maxInstances: 10,
    secrets: [
      "GEMINI_API_KEY",
      "SQL_SERVER_HOST",
      "SQL_SERVER_USER",
      "SQL_SERVER_PASSWORD",
      "SQL_SERVER_DATABASE",
      "SQL_SERVER_PORT"
    ],
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method Not Allowed",
            message: "Only POST method is allowed",
          });
        }

        if (!ragService) {
          return res.status(503).json({
            error: "Service Unavailable",
            message: "RAG service is not available. Please check server logs.",
          });
        }

        // Check SQL Server connection
        if (!sqlConnection || !process.env.SQL_SERVER_HOST) {
          return res.status(503).json({
            error: "Service Unavailable",
            message: "SQL Server is not configured. Please set SQL_SERVER_HOST secret.",
          });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          return res.status(500).json({
            error: "Configuration Error",
            message: "GEMINI_API_KEY is not configured. Please set it in Firebase Secrets.",
          });
        }

        const {query, topK = 4} = req.body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Query is required and must be a non-empty string.",
          });
        }

        // Ensure SQL pool is initialized
        const pool = sqlConnection.getSQLPool();
        if (!pool) {
          // Try to initialize
          const sqlConfig = {
            server: process.env.SQL_SERVER_HOST,
            database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI',
            port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
            encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false',
            trustServerCertificate: true,
          };

          if (process.env.SQL_SERVER_USER) {
            sqlConfig.user = process.env.SQL_SERVER_USER;
          }
          if (process.env.SQL_SERVER_PASSWORD) {
            sqlConfig.password = process.env.SQL_SERVER_PASSWORD;
          }

          await sqlConnection.initializeSQLPool(sqlConfig);
        }

        // Search similar chunks
        console.log(`🔍 Searching for: ${query}`);
        const contexts = await ragService.searchSimilar(
          query,
          geminiApiKey,
          'rag_documents',
          topK
        );

        if (contexts.length === 0) {
          return res.status(200).json({
            answer: "Tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong tài liệu.",
            sources: [],
            query: query,
          });
        }

        // Generate answer
        console.log(`💬 Generating answer with ${contexts.length} contexts`);
        const answer = await ragService.generateAnswer(query, contexts, geminiApiKey);

        // Format sources
        const sources = contexts.map(ctx => ({
          file_name: ctx.fileName,
          page_number: ctx.pageNumber,
          content_preview: ctx.content.substring(0, 200) + (ctx.content.length > 200 ? '...' : ''),
          similarity: ctx.similarity,
        }));

        return res.status(200).json({
          answer: answer,
          sources: sources,
          query: query,
        });
      } catch (error) {
        console.error("Error in ragChat:", error);
        return res.status(500).json({
          error: "Internal Server Error",
          message: error.message || "An unexpected error occurred",
        });
      }
    });
  }
);

/**
 * RAG Ingest Folder Endpoint - Ingest tất cả files trong folder vào SQL Server
 * POST /ragIngestFolder
 * Body: { folderPath: string }
 */
exports.ragIngestFolder = onRequest(
  {
    cors: true,
    maxInstances: 2, // Folder ingest có thể tốn thời gian
    secrets: [
      "GEMINI_API_KEY",
      "SQL_SERVER_HOST",
      "SQL_SERVER_USER",
      "SQL_SERVER_PASSWORD",
      "SQL_SERVER_DATABASE",
      "SQL_SERVER_PORT"
    ],
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({
            error: "Method Not Allowed",
            message: "Only POST method is allowed",
          });
        }

        if (!ragService) {
          return res.status(503).json({
            error: "Service Unavailable",
            message: "RAG service is not available. Please check server logs.",
          });
        }

        // Check SQL Server connection
        if (!sqlConnection || !process.env.SQL_SERVER_HOST) {
          return res.status(503).json({
            error: "Service Unavailable",
            message: "SQL Server is not configured. Please set SQL_SERVER_HOST secret.",
          });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          return res.status(500).json({
            error: "Configuration Error",
            message: "GEMINI_API_KEY is not configured. Please set it in Firebase Secrets.",
          });
        }

        const {folderPath} = req.body;
        
        if (!folderPath || typeof folderPath !== 'string') {
          return res.status(400).json({
            error: "Bad Request",
            message: "folderPath is required and must be a string. Example: 'C:\\MyData\\P-TK\\TBKT-25140T-250kVA'",
          });
        }

        // Validate folder path exists
        const fs = require('fs');
        if (!fs.existsSync(folderPath)) {
          return res.status(404).json({
            error: "Folder Not Found",
            message: `Folder not found: ${folderPath}`,
          });
        }

        // Ensure SQL pool is initialized
        const pool = sqlConnection.getSQLPool();
        if (!pool) {
          const sqlConfig = {
            server: process.env.SQL_SERVER_HOST,
            database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI',
            port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
            encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false',
            trustServerCertificate: true,
          };

          if (process.env.SQL_SERVER_USER) {
            sqlConfig.user = process.env.SQL_SERVER_USER;
          }
          if (process.env.SQL_SERVER_PASSWORD) {
            sqlConfig.password = process.env.SQL_SERVER_PASSWORD;
          }

          await sqlConnection.initializeSQLPool(sqlConfig);
        }

        // Ingest folder
        console.log(`📁 Ingesting folder: ${folderPath}`);
        const result = await ragService.ingestFolder(
          folderPath,
          geminiApiKey,
          'rag_documents'
        );

        return res.status(200).json({
          status: "success",
          message: `Đã ingest thành công ${result.totalChunks} chunks từ ${result.totalFiles} files`,
          data: result,
        });
      } catch (error) {
        console.error("Error in ragIngestFolder:", error);
        return res.status(500).json({
          error: "Internal Server Error",
          message: error.message || "An unexpected error occurred",
        });
      }
    });
  }
);