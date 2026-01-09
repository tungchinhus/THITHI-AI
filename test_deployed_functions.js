const https = require('https');

// Test healthCheck function
console.log('Testing healthCheck function...');
const healthCheckUrl = new URL('https://healthcheck-7wmcfqhioa-uc.a.run.app');

const healthCheckReq = https.request(healthCheckUrl, { method: 'GET' }, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('HealthCheck Response:', data);
    console.log('Status Code:', res.statusCode);
    console.log('\n---\n');
    
    // Test chatFunction after healthCheck
    testChatFunction();
  });
});

healthCheckReq.on('error', (error) => {
  console.error('HealthCheck Error:', error.message);
  testChatFunction();
});

healthCheckReq.end();

// Test chatFunction
function testChatFunction() {
  console.log('Testing chatFunction...');
  const chatUrl = new URL('https://chatfunction-7wmcfqhioa-uc.a.run.app');
  
  const postData = JSON.stringify({
    question: 'Xin chào, bạn có thể giúp gì cho tôi?'
  });
  
  const chatReq = https.request(chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('ChatFunction Response:', data);
      console.log('Status Code:', res.statusCode);
      try {
        const parsed = JSON.parse(data);
        console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Response is not JSON');
      }
    });
  });
  
  chatReq.on('error', (error) => {
    console.error('ChatFunction Error:', error.message);
  });
  
  chatReq.write(postData);
  chatReq.end();
}
