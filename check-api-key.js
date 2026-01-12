/**
 * Script kiểm tra API key và liệt kê models có sẵn
 */

const https = require('https');

const apiKey = process.argv[2] || 'AIzaSyCfLo3bdWBYjPB8XKcYMh62DFKqsmZrIMc';

console.log('='.repeat(60));
console.log('🔍 KIỂM TRA API KEY VÀ MODELS CÓ SẴN');
console.log('='.repeat(60));
console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}\n`);

// Test ListModels
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
        
        console.log(`✅ ListModels thành công!`);
        console.log(`📊 Tổng số models: ${models.length}\n`);
        
        // Tìm models hỗ trợ generateContent
        const availableModels = models.filter(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes('generateContent')
        );
        
        console.log(`📋 Models hỗ trợ generateContent (${availableModels.length}):`);
        availableModels.forEach(m => {
          const name = m.name.replace('models/', '');
          const displayName = m.displayName || name;
          console.log(`  ✅ ${name}`);
          console.log(`     Display: ${displayName}`);
          
          // Kiểm tra xem có phải model miễn phí không
          if (name.includes('1.5-flash') || name.includes('1.5-pro')) {
            console.log(`     🆓 Model miễn phí`);
          }
          console.log('');
        });
        
        // Thử test với model đầu tiên có sẵn
        if (availableModels.length > 0) {
          const testModel = availableModels[0].name.replace('models/', '');
          console.log(`\n🧪 Đang test GenerateContent với model: ${testModel}...`);
          testGenerateContent(apiKey, testModel);
        } else {
          console.log('❌ Không tìm thấy model nào hỗ trợ generateContent');
        }
      } catch (e) {
        console.error('❌ Lỗi parse JSON:', e.message);
      }
    } else {
      let errorMsg = `HTTP ${res.statusCode}`;
      try {
        const errorJson = JSON.parse(data);
        errorMsg = errorJson.error?.message || errorMsg;
      } catch (e) {
        errorMsg = data.substring(0, 200) || errorMsg;
      }
      console.error(`❌ Lỗi: ${errorMsg}`);
    }
  });
}).on('error', (err) => {
  console.error('❌ Lỗi network:', err.message);
});

function testGenerateContent(apiKey, modelName) {
  // Thử cả v1 và v1beta
  const versions = ['v1beta', 'v1'];
  let currentVersion = 0;
  
  function tryNext() {
    if (currentVersion >= versions.length) {
      console.log('❌ Không thể test với bất kỳ API version nào');
      return;
    }
    
    const version = versions[currentVersion];
    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey}`;
    
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
              console.log(`✅ GenerateContent thành công với ${version}!`);
              const response = json.candidates[0].content.parts[0].text;
              console.log(`📝 Response: ${response.substring(0, 150)}...`);
              console.log(`\n✅ API KEY HOẠT ĐỘNG TỐT!`);
              console.log(`💡 Model khuyến nghị: ${modelName}`);
              console.log(`💡 API version: ${version}`);
            } else {
              console.log(`⚠️ Response không đúng format với ${version}`);
              currentVersion++;
              tryNext();
            }
          } catch (e) {
            console.log(`⚠️ Lỗi parse JSON với ${version}:`, e.message);
            currentVersion++;
            tryNext();
          }
        } else {
          let errorMsg = `HTTP ${res.statusCode}`;
          try {
            const errorJson = JSON.parse(data);
            errorMsg = errorJson.error?.message || errorMsg;
          } catch (e) {
            errorMsg = data.substring(0, 200) || errorMsg;
          }
          
          if (res.statusCode === 404 && currentVersion < versions.length - 1) {
            console.log(`⚠️ Model không tìm thấy trong ${version}, thử version khác...`);
            currentVersion++;
            tryNext();
          } else {
            console.log(`❌ Lỗi với ${version}: ${errorMsg}`);
            if (currentVersion < versions.length - 1) {
              currentVersion++;
              tryNext();
            }
          }
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ Network error với ${version}:`, err.message);
      currentVersion++;
      tryNext();
    });
    
    req.write(requestBody);
    req.end();
  }
  
  tryNext();
}
