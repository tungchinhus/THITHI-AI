/**
 * Script kiểm tra nguyên nhân lỗi Gemini API
 * 
 * Sử dụng: node check-error.js [API_KEY]
 * Nếu không có API_KEY, sẽ lấy từ Firebase secrets
 */

const https = require('https');
const { execSync } = require('child_process');

// Lấy API key từ argument hoặc Firebase secrets
let apiKey = process.argv[2];

if (!apiKey) {
  console.log('🔍 Đang lấy API key từ Firebase secrets...\n');
  try {
    const secretOutput = execSync('firebase functions:secrets:access GEMINI_API_KEY', { encoding: 'utf-8' });
    apiKey = secretOutput.trim();
    if (!apiKey || apiKey.length < 20) {
      console.error('❌ Không tìm thấy API key hợp lệ trong Firebase secrets');
      console.log('\n💡 Cách sử dụng:');
      console.log('   node check-error.js YOUR_API_KEY');
      console.log('   hoặc set secret: echo YOUR_API_KEY | firebase functions:secrets:set GEMINI_API_KEY');
      process.exit(1);
    }
    console.log('✅ Đã lấy API key từ Firebase secrets\n');
  } catch (error) {
    console.error('❌ Không thể lấy API key từ Firebase secrets:', error.message);
    console.log('\n💡 Cách sử dụng:');
    console.log('   node check-error.js YOUR_API_KEY');
    process.exit(1);
  }
}

console.log('='.repeat(60));
console.log('🔍 KIỂM TRA NGUYÊN NHÂN LỖI GEMINI API');
console.log('='.repeat(60));
console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}\n`);

// Test 1: Kiểm tra ListModels API
console.log('📋 Test 1: Kiểm tra ListModels API...');
testListModels(apiKey)
  .then(() => {
    // Test 2: Kiểm tra GenerateContent với model miễn phí
    console.log('\n💬 Test 2: Kiểm tra GenerateContent API với gemini-1.5-flash...');
    return testGenerateContent(apiKey, 'gemini-1.5-flash');
  })
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ TẤT CẢ TEST ĐỀU THÀNH CÔNG!');
    console.log('='.repeat(60));
    console.log('\n💡 Nếu vẫn gặp lỗi quota trong ứng dụng:');
    console.log('   1. Kiểm tra logs: firebase functions:log --only chatFunction');
    console.log('   2. Kiểm tra quota: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas');
    console.log('   3. Đảm bảo Function đã được deploy với API key mới');
  })
  .catch((error) => {
    console.log('\n' + '='.repeat(60));
    console.log('❌ PHÁT HIỆN LỖI!');
    console.log('='.repeat(60));
    console.error('\nLỗi chi tiết:', error.message);
    
    if (error.status === 401 || error.message.includes('API key')) {
      console.log('\n🔧 CÁCH KHẮC PHỤC:');
      console.log('   1. Tạo API key mới: https://makersuite.google.com/app/apikey');
      console.log('   2. Set lại: echo YOUR_NEW_KEY | firebase functions:secrets:set GEMINI_API_KEY');
      console.log('   3. Deploy lại: firebase deploy --only functions:chatFunction');
    } else if (error.status === 429 || error.message.includes('quota')) {
      console.log('\n🔧 CÁCH KHẮC PHỤC:');
      console.log('   1. Đợi reset quota (thường reset theo ngày/tháng)');
      console.log('   2. Kiểm tra quota: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas');
      console.log('   3. Tạo API key mới để có quota mới');
      console.log('   4. Function sẽ tự động chọn model miễn phí (gemini-1.5-flash)');
    } else if (error.status === 403) {
      console.log('\n🔧 CÁCH KHẮC PHỤC:');
      console.log('   1. Enable Generative Language API:');
      console.log('      https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
      console.log('   2. Kiểm tra API key có đúng project không');
    } else {
      console.log('\n🔧 CÁCH KHẮC PHỤC:');
      console.log('   1. Kiểm tra logs: firebase functions:log --only chatFunction');
      console.log('   2. Kiểm tra API key: firebase functions:secrets:access GEMINI_API_KEY');
      console.log('   3. Thử tạo API key mới: https://makersuite.google.com/app/apikey');
    }
    
    process.exit(1);
  });

/**
 * Test ListModels API
 */
function testListModels(apiKey) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const models = json.models || [];
            const freeModels = models.filter(m => 
              m.name && (
                m.name.includes('1.5-flash') || 
                m.name.includes('1.5-pro')
              )
            );
            
            console.log(`   ✅ ListModels thành công!`);
            console.log(`   📊 Tổng số models: ${models.length}`);
            console.log(`   🆓 Models miễn phí: ${freeModels.length}`);
            
            if (freeModels.length > 0) {
              console.log(`   ✅ Tìm thấy models miễn phí:`);
              freeModels.slice(0, 3).forEach(m => {
                console.log(`      - ${m.name.replace('models/', '')}`);
              });
            }
            
            resolve();
          } catch (e) {
            reject(new Error(`Parse JSON error: ${e.message}`));
          }
        } else {
          let errorMsg = `HTTP ${res.statusCode}`;
          try {
            const errorJson = JSON.parse(data);
            errorMsg = errorJson.error?.message || errorMsg;
          } catch (e) {
            errorMsg = data.substring(0, 200) || errorMsg;
          }
          
          const error = new Error(errorMsg);
          error.status = res.statusCode;
          reject(error);
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });
  });
}

/**
 * Test GenerateContent API
 */
function testGenerateContent(apiKey, modelName) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const requestBody = JSON.stringify({
      contents: [{
        parts: [{ text: 'Xin chào! Hãy trả lời ngắn gọn bằng tiếng Việt.' }]
      }]
    });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.candidates && json.candidates[0] && json.candidates[0].content) {
              console.log(`   ✅ GenerateContent thành công với model: ${modelName}`);
              const response = json.candidates[0].content.parts[0].text;
              console.log(`   📝 Response: ${response.substring(0, 100)}...`);
              resolve();
            } else {
              reject(new Error('Invalid response format'));
            }
          } catch (e) {
            reject(new Error(`Parse JSON error: ${e.message}`));
          }
        } else {
          let errorMsg = `HTTP ${res.statusCode}`;
          let errorCode = res.statusCode;
          
          try {
            const errorJson = JSON.parse(data);
            errorMsg = errorJson.error?.message || errorMsg;
            errorCode = errorJson.error?.code || errorCode;
            
            // Log chi tiết lỗi
            console.log(`   ❌ Lỗi chi tiết:`, JSON.stringify(errorJson.error, null, 2));
          } catch (e) {
            errorMsg = data.substring(0, 200) || errorMsg;
          }
          
          const error = new Error(errorMsg);
          error.status = errorCode;
          error.details = data;
          reject(error);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });
    
    req.write(requestBody);
    req.end();
  });
}

