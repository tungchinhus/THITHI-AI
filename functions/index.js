const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");

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
    secrets: ["GEMINI_API_KEY"], // Declare secret
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

      // Get question from request body
      const {question} = req.body;

      // Validate question
      if (!question || typeof question !== "string" || question.trim() === "") {
        return res.status(400).json({
          error: "Bad Request",
          message: "Question is required and must be a non-empty string",
        });
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
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:82',message:'Calling ListModels API',data:{hasCachedModel:!!cachedModel,cacheAge:now-modelCacheTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              const listResponse = await fetch(listModelsUrl);
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:85',message:'ListModels response',data:{status:listResponse.status,ok:listResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              
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
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:156',message:'Model selected',data:{selectedModel,isFreeModel,availableModelsCount:availableModels.length,availableModels:availableModels.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                  
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
                    // #region agent log
                    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:170',message:'Fallback model selected',data:{selectedModel,availableModelsCount:availableModels.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
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
              // Tạo prompt với yêu cầu trả lời bằng tiếng Việt
              const systemPrompt = "Bạn là một trợ lý AI thông minh và hữu ích. Hãy luôn trả lời bằng tiếng Việt một cách tự nhiên, dễ hiểu và thân thiện. Nếu người dùng hỏi bằng tiếng Việt, hãy trả lời bằng tiếng Việt. Nếu người dùng hỏi bằng ngôn ngữ khác, bạn có thể trả lời bằng ngôn ngữ đó hoặc tiếng Việt tùy theo ngữ cảnh.\n\n";
              
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
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:196',message:'Before generateContent API call',data:{selectedModel,apiVersion,apiVersionToUse,questionLength:question.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              
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
                
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:219',message:'API call attempt',data:{attempt:attempt+1,apiVersionToUse,selectedModel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody)
                });
                
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:228',message:'API response received',data:{status:response.status,ok:response.ok,attempt:attempt+1,apiVersionToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
                // #endregion
                
                // Nếu thành công, break
                if (response.ok) {
                  break;
                }
                
                // Nếu 404 và đang dùng v1, thử v1beta ở lần thử tiếp theo
                if (response.status === 404 && apiVersionToUse === 'v1' && attempt === 0) {
                  console.log(`⚠️ Model ${selectedModel} not found in v1, trying v1beta...`);
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:233',message:'Retrying with v1beta',data:{selectedModel,reason:'404 in v1'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
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
                    
                    // #region agent log
                    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:254',message:'Error response parsed',data:{errorCode:errorJson.error?.code,errorMessage:errorJson.error?.message,status:response.status,selectedModel,apiVersionToUse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
                    // #endregion
                    
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
                    // #region agent log
                    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/index.js:270',message:'Error text (non-JSON)',data:{errorText:errorText.substring(0,200),status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
                    // #endregion
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

