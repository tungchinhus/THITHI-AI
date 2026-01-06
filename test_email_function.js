// Script để test email function trong Firebase shell
// Copy và paste vào Firebase Functions shell

// Lấy token từ browser localStorage trước:
// localStorage.getItem('thihi_microsoft_token')

// Test function với email question và token
const testEmailAccess = async () => {
  // Thay YOUR_TOKEN bằng token thực tế từ browser
  const testToken = 'YOUR_TOKEN_HERE'; // Lấy từ localStorage.getItem('thihi_microsoft_token')
  
  const req = {
    method: 'POST',
    body: {
      question: "trong hợp mail tôi co mail nào mới không?",
      microsoftAccessToken: testToken
    }
  };
  
  const res = {
    status: (code) => ({
      json: (data) => {
        console.log('\n=== RESPONSE ===');
        console.log('Status:', code);
        console.log('Answer:', data.answer?.substring(0, 200));
        console.log('Sources:', data.sources);
        return { status: code, json: data };
      }
    })
  };
  
  console.log('🧪 Testing email access...');
  console.log('Question:', req.body.question);
  console.log('Has token:', !!req.body.microsoftAccessToken);
  console.log('Token length:', req.body.microsoftAccessToken?.length || 0);
  
  try {
    await chatFunction(req, res);
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Chạy test
testEmailAccess();

