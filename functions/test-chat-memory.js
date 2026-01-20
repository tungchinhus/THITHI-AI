/**
 * Test Script: Kiểm tra Chat Memory Service
 * 
 * Chạy script này để test xem chat memory có hoạt động không
 * 
 * Usage:
 *   node test-chat-memory.js
 */

const admin = require('firebase-admin');
const { initializeSQLPool, getSQLPool } = require('./sql-connection');
const sqlChatMemoryService = require('./sql-chat-memory-service');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Test configuration
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_QUESTION = 'Tên tôi là CHINH';
const TEST_ANSWER = 'Chào Chinh! Tôi sẽ nhớ tên bạn.';

async function testChatMemory() {
  console.log('🧪 Starting Chat Memory Test...\n');

  // Test 1: Check SQL Server Configuration
  console.log('📋 Test 1: Kiểm tra SQL Server Configuration');
  const hasSQLHost = !!process.env.SQL_SERVER_HOST;
  const hasSQLUser = !!process.env.SQL_SERVER_USER;
  const hasSQLPassword = !!process.env.SQL_SERVER_PASSWORD;
  const hasSQLDatabase = !!process.env.SQL_SERVER_DATABASE;
  const useWindowsAuth = !hasSQLUser && !hasSQLPassword;

  console.log('   SQL_SERVER_HOST:', hasSQLHost ? '✅ Set' : '❌ Not set');
  console.log('   Authentication:', useWindowsAuth ? '✅ Windows Authentication' : 'SQL Server Authentication');
  console.log('   SQL_SERVER_USER:', hasSQLUser ? '✅ Set' : '❌ Not set (using Windows Auth)');
  console.log('   SQL_SERVER_PASSWORD:', hasSQLPassword ? '✅ Set' : '❌ Not set (using Windows Auth)');
  console.log('   SQL_SERVER_DATABASE:', hasSQLDatabase ? '✅ Set' : '❌ Not set');

  if (!hasSQLHost) {
    console.log('\n⚠️ SQL Server chưa được cấu hình đầy đủ!');
    console.log('   Hệ thống sẽ fallback vào Firestore.\n');
  } else if (useWindowsAuth) {
    console.log('\n✅ SQL Server sẽ sử dụng Windows Authentication (Integrated Security)');
  } else if (!hasSQLUser || !hasSQLPassword) {
    console.log('\n⚠️ SQL Server Authentication chưa được cấu hình đầy đủ!');
    console.log('   Nếu muốn dùng Windows Authentication, không cần set SQL_SERVER_USER và SQL_SERVER_PASSWORD.');
    console.log('   Hệ thống sẽ fallback vào Firestore.\n');
  }

  // Test 2: Initialize SQL Connection Pool
  let sqlPoolInitialized = false;
  if (hasSQLHost && (useWindowsAuth || (hasSQLUser && hasSQLPassword))) {
    console.log('\n📋 Test 2: Khởi tạo SQL Connection Pool');
    try {
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
      
      await initializeSQLPool(sqlConfig);
      sqlPoolInitialized = true;
      console.log('   ✅ SQL Connection Pool initialized');
    } catch (error) {
      console.log('   ❌ Failed to initialize SQL Connection Pool:', error.message);
      console.log('   Hệ thống sẽ fallback vào Firestore.\n');
    }
  }

  // Test 3: Initialize Chat Memory Service
  console.log('\n📋 Test 3: Khởi tạo Chat Memory Service');
  if (sqlPoolInitialized && sqlChatMemoryService) {
    // Mock generateEmbedding function for testing
    const mockGenerateEmbedding = async (text) => {
      // Return mock embedding (768 dimensions)
      return new Array(768).fill(0).map(() => Math.random() * 0.1);
    };
    
    sqlChatMemoryService.initializeEmbeddingFunctions(mockGenerateEmbedding);
    console.log('   ✅ Chat Memory Service initialized');
  } else {
    console.log('   ⚠️ Chat Memory Service not available (will use Firestore)');
  }

  // Test 4: Create Session
  console.log('\n📋 Test 4: Tạo Chat Session');
  let sessionId = null;
  if (sqlPoolInitialized && sqlChatMemoryService) {
    try {
      sessionId = await sqlChatMemoryService.upsertChatSession(TEST_USER_ID, 'Test Session');
      console.log('   ✅ Session created:', sessionId);
    } catch (error) {
      console.log('   ❌ Failed to create session:', error.message);
    }
  } else {
    // Test Firestore fallback
    try {
      const sessionRef = db.collection('chatSessions');
      const sessionDoc = await sessionRef.add({
        userId: TEST_USER_ID,
        title: 'Test Session',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        messageCount: 0,
        isActive: true
      });
      sessionId = sessionDoc.id;
      console.log('   ✅ Session created in Firestore:', sessionId);
    } catch (error) {
      console.log('   ❌ Failed to create session in Firestore:', error.message);
    }
  }

  // Test 5: Save Chat Memory
  console.log('\n📋 Test 5: Lưu Chat Memory');
  if (sqlPoolInitialized && sqlChatMemoryService && sessionId) {
    try {
      const userMemoryId = await sqlChatMemoryService.saveChatMemory(
        TEST_USER_ID,
        TEST_QUESTION,
        'user',
        sessionId,
        { timestamp: new Date().toISOString() }
      );
      console.log('   ✅ User message saved:', userMemoryId);

      const assistantMemoryId = await sqlChatMemoryService.saveChatMemory(
        TEST_USER_ID,
        TEST_ANSWER,
        'assistant',
        sessionId,
        { timestamp: new Date().toISOString() }
      );
      console.log('   ✅ Assistant message saved:', assistantMemoryId);
    } catch (error) {
      console.log('   ❌ Failed to save memory:', error.message);
      console.log('   Error stack:', error.stack?.substring(0, 200));
    }
  } else if (sessionId) {
    // Test Firestore fallback
    try {
      const memoryRef = db.collection('chatMemory');
      
      await memoryRef.add({
        userId: TEST_USER_ID,
        sessionId: sessionId,
        content: TEST_QUESTION,
        contentType: 'user',
        metadata: { timestamp: new Date().toISOString() },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('   ✅ User message saved to Firestore');

      await memoryRef.add({
        userId: TEST_USER_ID,
        sessionId: sessionId,
        content: TEST_ANSWER,
        contentType: 'assistant',
        metadata: { timestamp: new Date().toISOString() },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('   ✅ Assistant message saved to Firestore');
    } catch (error) {
      console.log('   ❌ Failed to save memory to Firestore:', error.message);
    }
  }

  // Test 6: Search Chat Memory
  console.log('\n📋 Test 6: Tìm kiếm Chat Memory');
  if (sqlPoolInitialized && sqlChatMemoryService) {
    try {
      const memories = await sqlChatMemoryService.searchChatMemory(
        TEST_USER_ID,
        'Tên tôi là gì?',
        {
          similarityThreshold: 0.3,
          topN: 5,
          sessionId: sessionId
        }
      );
      console.log('   ✅ Found', memories.length, 'memories');
      memories.forEach((mem, idx) => {
        console.log(`   ${idx + 1}. [${mem.contentType}] ${mem.content.substring(0, 50)}... (Similarity: ${(mem.similarity * 100).toFixed(1)}%)`);
      });
    } catch (error) {
      console.log('   ❌ Failed to search memory:', error.message);
    }
  }

  // Test 7: Check Data in Database
  console.log('\n📋 Test 7: Kiểm tra Dữ liệu trong Database');
  if (sqlPoolInitialized) {
    try {
      const { executeQuery } = require('./sql-connection');
      const sessionResult = await executeQuery('SELECT COUNT(*) as Count FROM ChatSessions WHERE UserId = @userId', {
        userId: TEST_USER_ID
      });
      const memoryResult = await executeQuery('SELECT COUNT(*) as Count FROM ChatMemory WHERE UserId = @userId', {
        userId: TEST_USER_ID
      });
      
      console.log('   Sessions:', sessionResult.recordset[0]?.Count || 0);
      console.log('   Memories:', memoryResult.recordset[0]?.Count || 0);
    } catch (error) {
      console.log('   ❌ Failed to check data:', error.message);
    }
  } else {
    // Check Firestore
    try {
      const sessionsSnapshot = await db.collection('chatSessions').where('userId', '==', TEST_USER_ID).get();
      const memoriesSnapshot = await db.collection('chatMemory').where('userId', '==', TEST_USER_ID).get();
      
      console.log('   Sessions in Firestore:', sessionsSnapshot.size);
      console.log('   Memories in Firestore:', memoriesSnapshot.size);
    } catch (error) {
      console.log('   ❌ Failed to check Firestore data:', error.message);
    }
  }

  console.log('\n✅ Test completed!');
  console.log('\n📝 Summary:');
  console.log('   - SQL Server configured:', hasSQLHost && hasSQLUser && hasSQLPassword ? '✅' : '❌');
  console.log('   - SQL Pool initialized:', sqlPoolInitialized ? '✅' : '❌');
  console.log('   - Using:', sqlPoolInitialized ? 'SQL Server' : 'Firestore (fallback)');
  console.log('   - Test User ID:', TEST_USER_ID);
  console.log('   - Session ID:', sessionId || 'N/A');
  
  process.exit(0);
}

// Run test
testChatMemory().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
