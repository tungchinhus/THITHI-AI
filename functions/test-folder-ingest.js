/**
 * Test Script để ingest folder vào RAG System
 * 
 * Cách sử dụng:
 * 1. Set environment variables:
 *    export GEMINI_API_KEY="your_key"
 *    export SQL_SERVER_HOST="localhost"
 *    export SQL_SERVER_DATABASE="THITHI_AI"
 * 
 * 2. Chạy test:
 *    node test-folder-ingest.js
 */

const {ingestFolder, ensureRAGTable} = require('./rag-service');
const {initializeSQLPool, getSQLPool} = require('./sql-connection');
const fs = require('fs');
const path = require('path');

// #region agent log
try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:17',message:'Script loaded - test-folder-ingest.js started',data:{nodeVersion:process.version,cwd:process.cwd(),scriptPath:__filename}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
// #endregion

// #region agent log
try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:20',message:'Environment check - GEMINI_API_KEY',data:{hasKey:!!process.env.GEMINI_API_KEY,keyType:typeof process.env.GEMINI_API_KEY,keyLength:process.env.GEMINI_API_KEY?process.env.GEMINI_API_KEY.length:0,keyPrefix:process.env.GEMINI_API_KEY?process.env.GEMINI_API_KEY.substring(0,10):'undefined',allEnvKeys:Object.keys(process.env).filter(k=>k.includes('GEMINI')||k.includes('SQL')).join(',')}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
// #endregion

// Configuration
const FOLDER_PATH = process.env.FOLDER_PATH || 'C:\\MyData\\P-TK\\TBKT-25140T-250kVA';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// #region agent log
try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:25',message:'After assignment - GEMINI_API_KEY',data:{hasKey:!!GEMINI_API_KEY,keyType:typeof GEMINI_API_KEY,keyLength:GEMINI_API_KEY?GEMINI_API_KEY.length:0,keyPrefix:GEMINI_API_KEY?GEMINI_API_KEY.substring(0,10):'undefined'}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
// #endregion
const SQL_CONFIG = {
  server: process.env.SQL_SERVER_HOST || 'localhost',
  database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI',
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false',
  trustServerCertificate: true,
  // SQL Authentication defaults
  user: process.env.SQL_SERVER_USER || 'sa',
  password: process.env.SQL_SERVER_PASSWORD || '123456',
};

/**
 * Main test function
 */
async function testFolderIngest() {
  console.log('🧪 RAG Folder Ingest Test');
  console.log('='.repeat(50));

  // Check prerequisites
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:47',message:'Before GEMINI_API_KEY check',data:{geminiKeyValue:GEMINI_API_KEY||'undefined',geminiKeyType:typeof GEMINI_API_KEY,geminiKeyTruthy:!!GEMINI_API_KEY,checkResult:!GEMINI_API_KEY}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  if (!GEMINI_API_KEY) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:50',message:'GEMINI_API_KEY check failed - exiting',data:{geminiKeyValue:GEMINI_API_KEY||'undefined',processEnvCheck:process.env.GEMINI_API_KEY||'undefined'}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    console.error('❌ GEMINI_API_KEY not set');
    console.log('');
    console.log('💡 Cách khắc phục:');
    console.log('   PowerShell: $env:GEMINI_API_KEY="your_key"');
    console.log('   CMD:        set GEMINI_API_KEY=your_key');
    console.log('   Hoặc chạy:  ingest-folder.bat (Windows)');
    console.log('   Hoặc chạy:  ingest-folder.ps1 (PowerShell)');
    process.exit(1);
  }
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:57',message:'GEMINI_API_KEY check passed',data:{geminiKeyLength:GEMINI_API_KEY.length,geminiKeyPrefix:GEMINI_API_KEY.substring(0,10)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion

  console.log('✅ GEMINI_API_KEY: Set');
  console.log(`✅ Folder: ${FOLDER_PATH}`);
  console.log(`✅ SQL Server: ${SQL_CONFIG.server}:${SQL_CONFIG.port}/${SQL_CONFIG.database}`);
  console.log(`✅ SQL User: ${SQL_CONFIG.user}`);

  try {
    // Initialize SQL connection
    console.log('\n🔌 Initializing SQL Server connection...');
    await initializeSQLPool(SQL_CONFIG);
    console.log('✅ SQL Server connected');

    // Ensure table exists
    await ensureRAGTable('rag_documents');

    // Ingest folder
    console.log(`\n📁 Starting folder ingest...`);
    const result = await ingestFolder(
      FOLDER_PATH,
      GEMINI_API_KEY,
      'rag_documents'
    );

    console.log('\n✅ Ingest completed!');
    console.log(`   Total files: ${result.totalFiles}`);
    console.log(`   Total chunks: ${result.totalChunks}`);
    console.log('\n📋 File details:');
    result.files.forEach((file, idx) => {
      const statusIcon = file.status === 'success' ? '✅' : '❌';
      console.log(`   ${idx + 1}. ${statusIcon} ${file.name} - ${file.chunks} chunks`);
      if (file.error) {
        console.log(`      Error: ${file.error}`);
      }
    });

    console.log('\n🎉 Test completed successfully!');
    console.log('💡 Bây giờ bạn có thể chat với RAG system để tìm thông tin trong folder này');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:116',message:'About to call testFolderIngest()',data:{isMainModule:require.main===module}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  testFolderIngest().catch((error) => {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'test-folder-ingest.js:118',message:'testFolderIngest() error',data:{errorMessage:error.message,errorStack:error.stack}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    console.error(error);
    process.exit(1);
  });
}

module.exports = {testFolderIngest};
