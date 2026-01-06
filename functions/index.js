const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {Client} = require("@microsoft/microsoft-graph-client");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");

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
      "MICROSOFT_CLIENT_SECRET" // For future refresh token implementation
      // Note: MICROSOFT_TENANT_ID removed - not needed in backend, already in frontend environment.ts
    ],
  },
  async (req, res) => {
    // Handle CORS preflight
    cors(req, res, async () => {
      // Only allow POST requests
      if (req.method !== "POST") {
        return res.status(405).json({
          error: "Method Not Allowed",
          message: "Only POST method is allowed",
        });
      }

      // Get question and Microsoft access token from request body
      const {question, microsoftAccessToken} = req.body;
      // #region agent log
      console.log('📥 Backend received request:', {
        question: question?.substring(0, 50),
        hasToken: !!microsoftAccessToken,
        tokenLength: microsoftAccessToken?.length || 0,
        tokenPrefix: microsoftAccessToken?.substring(0, 20) || 'none'
      });
      // #endregion

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
      // Xử lý AI chat với Google Gemini
      // ============================================
      
      let answer = "";
      const sources = [];
      
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
              
              // Tạo prompt với yêu cầu trả lời bằng tiếng Việt và thông tin ngày hiện tại
              let systemPrompt = `Bạn là một trợ lý AI thông minh và hữu ích. Hãy luôn trả lời bằng tiếng Việt một cách tự nhiên, dễ hiểu và thân thiện. Nếu người dùng hỏi bằng tiếng Việt, hãy trả lời bằng tiếng Việt. Nếu người dùng hỏi bằng ngôn ngữ khác, bạn có thể trả lời bằng ngôn ngữ đó hoặc tiếng Việt tùy theo ngữ cảnh.

⚠️ QUAN TRỌNG VỀ THỜI GIAN:
- Ngày giờ hiện tại (theo múi giờ Việt Nam): ${currentDateTimeStr}
- Khi người dùng hỏi về "hôm nay", "ngày hôm nay", "hôm nay là ngày mấy", hoặc các câu hỏi tương tự về ngày hiện tại, bạn PHẢI sử dụng thông tin ngày giờ hiện tại ở trên.
- KHÔNG được sử dụng thông tin ngày từ training data hoặc dữ liệu cũ.
- Luôn trả lời chính xác về ngày hiện tại dựa trên thông tin được cung cấp ở trên.

`;
              
              // Thêm email context nếu có
              if (emailContext) {
                systemPrompt += `\n📧 THÔNG TIN EMAIL TỪ OUTLOOK:\n${emailContext}\n\nKhi người dùng hỏi về email, hãy sử dụng thông tin email ở trên để trả lời. Nếu không tìm thấy email phù hợp, hãy thông báo rõ ràng.\n\n`;
                // #region agent log
                console.log('✅ Email context added to prompt:', emailContext.substring(0, 200));
                // #endregion
              } else {
                // #region agent log
                console.log('⚠️ No email context to add to prompt');
                // #endregion
              }
              
              // Thêm OneDrive context nếu có
              if (oneDriveContext) {
                systemPrompt += `\n📁 THÔNG TIN TỪ ONEDRIVE:\n${oneDriveContext}\n\nKhi người dùng hỏi về file hoặc tài liệu trong OneDrive, hãy sử dụng thông tin ở trên để trả lời. Nếu cần tóm tắt nội dung file, hãy làm ngắn gọn và thông minh.\n\n`;
                console.log('✅ OneDrive context added to prompt:', oneDriveContext.substring(0, 200));
              } else {
                console.log('⚠️ No OneDrive context to add to prompt');
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
                const requestBody = apiVersionToUse === 'v1beta' 
                  ? {
                      contents: [{
                        parts: [{ text: question }]
                      }],
                      systemInstruction: {
                        parts: [{ text: systemPrompt }]
                      }
                    }
                  : {
                      contents: [{
                        parts: [{ text: systemPrompt + question }]
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
                answer = result.candidates[0].content.parts[0].text;
                console.log(`Successfully used model: ${selectedModel}`);
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
      
      const response = {
        answer: answer,
        sources: sources,
        // Hoặc có thể trả về format khác:
        // content: answer,
        // citations: sources
      };

      // Return success response
      return res.status(200).json(response);
    });
  }
);

/**
 * Helper function: Check if question is related to email
 */
function isEmailRelatedQuestion(question) {
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

