// Diagnostic script to test environment variables
console.log('=== Node.js Environment Check ===');
console.log('TEST_VAR_CMD:', process.env.TEST_VAR_CMD || 'undefined');
var geminiKey = process.env.GEMINI_API_KEY;
var geminiKeyPrefix = geminiKey ? geminiKey.substring(0, 20) : '';
var geminiKeySuffix = '...';
var geminiKeyDisplay = geminiKeyPrefix ? geminiKeyPrefix.concat(geminiKeySuffix) : 'undefined';
console.log('GEMINI_API_KEY:', geminiKeyDisplay);
console.log('SQL_SERVER_HOST:', process.env.SQL_SERVER_HOST || 'undefined');
console.log('SQL_SERVER_DATABASE:', process.env.SQL_SERVER_DATABASE || 'undefined');
console.log('SQL_SERVER_USER:', process.env.SQL_SERVER_USER || 'undefined');
console.log('FOLDER_PATH:', process.env.FOLDER_PATH || 'undefined');
console.log('');

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is undefined in Node.js');
  process.exit(1);
} else {
  console.log('✅ GEMINI_API_KEY is set correctly in Node.js');
  process.exit(0);
}
