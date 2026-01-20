/**
 * Test RAG System qua HTTP (Firebase Functions)
 * 
 * Cách sử dụng:
 * 1. Deploy functions trước:
 *    firebase deploy --only functions:ragIngest,functions:ragChat
 * 
 * 2. Set function URL:
 *    export FUNCTION_URL="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net"
 * 
 * 3. Chạy test:
 *    node test-rag-http.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const FUNCTION_URL = process.env.FUNCTION_URL || 'http://localhost:5001/YOUR_PROJECT/us-central1';
const TEST_PDF_PATH = './test-document.pdf'; // Đặt file PDF test vào đây

/**
 * Encode file to base64
 */
function encodeFileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

/**
 * Test 1: Ingest PDF via HTTP
 */
async function testIngestHTTP() {
  console.log('\n📥 TEST 1: Ingest PDF via HTTP');
  console.log('='.repeat(50));

  try {
    // Check if PDF file exists
    if (!fs.existsSync(TEST_PDF_PATH)) {
      console.error(`❌ PDF file not found: ${TEST_PDF_PATH}`);
      console.log('💡 Tạo file PDF test hoặc đổi đường dẫn TEST_PDF_PATH');
      return false;
    }

    const fileName = path.basename(TEST_PDF_PATH);
    const fileBase64 = encodeFileToBase64(TEST_PDF_PATH);

    console.log(`📄 File: ${fileName} (${fileBase64.length} base64 chars)`);
    console.log(`🌐 URL: ${FUNCTION_URL}/ragIngest`);

    const response = await fetch(`${FUNCTION_URL}/ragIngest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: fileBase64,
        fileName: fileName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Ingest failed:', result);
      return false;
    }

    console.log('✅ Ingest successful!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    if (result.data) {
      console.log(`   - Total chunks: ${result.data.totalChunks}`);
      console.log(`   - Total pages: ${result.data.totalPages}`);
      console.log(`   - File name: ${result.data.fileName}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Ingest failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Chat via HTTP
 */
async function testChatHTTP() {
  console.log('\n💬 TEST 2: Chat via HTTP');
  console.log('='.repeat(50));

  const testQueries = [
    'Máy bơm có công suất bao nhiêu?',
    'Hãy tóm tắt thông tin về sản phẩm',
    'Có những tính năng gì?',
  ];

  for (const query of testQueries) {
    try {
      console.log(`\n❓ Question: "${query}"`);
      console.log(`🌐 URL: ${FUNCTION_URL}/ragChat`);

      const response = await fetch(`${FUNCTION_URL}/ragChat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          topK: 4,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Chat failed:', result);
        continue;
      }

      console.log(`\n✅ Answer:`);
      console.log(`   ${result.answer}`);
      
      if (result.sources && result.sources.length > 0) {
        console.log(`\n📚 Sources (${result.sources.length}):`);
        result.sources.forEach((source, idx) => {
          console.log(`   ${idx + 1}. ${source.file_name}, trang ${source.page_number}`);
          console.log(`      Similarity: ${(source.similarity * 100).toFixed(2)}%`);
          console.log(`      Preview: ${source.content_preview.substring(0, 80)}...`);
        });
      }
    } catch (error) {
      console.error(`❌ Chat failed for "${query}":`, error.message);
    }
  }
}

/**
 * Test 3: Health check
 */
async function testHealthCheck() {
  console.log('\n🏥 TEST 3: Health Check');
  console.log('='.repeat(50));

  try {
    // Test với invalid request để xem error handling
    const response = await fetch(`${FUNCTION_URL}/ragChat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing query
      }),
    });

    const result = await response.json();

    if (response.status === 400) {
      console.log('✅ Error handling works correctly');
      console.log(`   Error: ${result.message}`);
    } else {
      console.log('⚠️  Unexpected response:', result);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

/**
 * Main test function
 */
async function runHTTPTests() {
  console.log('🧪 RAG System HTTP Test Suite');
  console.log('='.repeat(50));

  if (!FUNCTION_URL || FUNCTION_URL.includes('YOUR_PROJECT')) {
    console.error('❌ FUNCTION_URL not set correctly');
    console.log('💡 Set it: export FUNCTION_URL="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net"');
    process.exit(1);
  }

  console.log(`✅ Function URL: ${FUNCTION_URL}`);

  try {
    // Test health check first
    await testHealthCheck();

    // Test ingest
    const ingestSuccess = await testIngestHTTP();

    if (ingestSuccess) {
      // Wait a bit for processing
      console.log('\n⏳ Waiting 2 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test chat
      await testChatHTTP();
    } else {
      console.log('\n⚠️  Skipping chat tests (ingest failed)');
    }

    console.log('\n✅ All HTTP tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runHTTPTests().catch(console.error);
}

module.exports = {
  testIngestHTTP,
  testChatHTTP,
  testHealthCheck,
  runHTTPTests,
};
