/**
 * Script để test và debug RAG search
 * Chạy: node test-rag-search-debug.js
 * 
 * Cần set environment variables:
 * - SQL_SERVER_HOST
 * - SQL_SERVER_DATABASE
 * - SQL_SERVER_USER (optional, nếu dùng Windows Auth thì không cần)
 * - SQL_SERVER_PASSWORD (optional)
 * - GEMINI_API_KEY hoặc GOOGLE_API_KEY
 * 
 * Hoặc tạo file .env trong thư mục functions với các biến trên
 */

const ragService = require('./rag-service');
const {initializeSQLPool, getSQLPool} = require('./sql-connection');

// Try to load dotenv if available (optional)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, use environment variables directly
  console.log('ℹ️ dotenv not found, using system environment variables');
}

async function testRAGSearch() {
  console.log('🧪 Testing RAG Search...\n');
  
  // Check environment variables
  console.log('0️⃣ Checking environment variables...');
  const sqlHost = process.env.SQL_SERVER_HOST;
  const sqlDatabase = process.env.SQL_SERVER_DATABASE || 'THITHI_AI';
  const sqlUser = process.env.SQL_SERVER_USER;
  const sqlPassword = process.env.SQL_SERVER_PASSWORD;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  console.log(`   SQL_SERVER_HOST: ${sqlHost || '❌ not set'}`);
  console.log(`   SQL_SERVER_DATABASE: ${sqlDatabase}`);
  console.log(`   SQL_SERVER_USER: ${sqlUser || '⚠️ not set (will use Windows Auth)'}`);
  console.log(`   GEMINI_API_KEY: ${apiKey ? '✅ set' : '❌ not set'}\n`);
  
  if (!sqlHost) {
    console.error('❌ SQL_SERVER_HOST is required!');
    console.error('   Set it: $env:SQL_SERVER_HOST="localhost" (PowerShell)');
    console.error('   Or: export SQL_SERVER_HOST="localhost" (Bash)');
    return;
  }
  
  // 1. Check SQL Server connection
  console.log('1️⃣ Checking SQL Server connection...');
  try {
    const sqlConfig = {
      server: sqlHost,
      database: sqlDatabase,
      port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
      options: {
        encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false',
        trustServerCertificate: true
      }
    };
    
    if (sqlUser) {
      sqlConfig.user = sqlUser;
      sqlConfig.password = sqlPassword;
      console.log(`   Using SQL Server Authentication`);
    } else {
      console.log(`   Using Windows Authentication`);
    }
    
    await initializeSQLPool(sqlConfig);
    const pool = getSQLPool();
    
    if (!pool || !pool.connected) {
      throw new Error('SQL pool not connected');
    }
    
    console.log('✅ SQL Server connected\n');
  } catch (error) {
    console.error('❌ SQL Server connection failed:', error.message);
    return;
  }
  
  // 2. Check table exists and has data
  console.log('2️⃣ Checking rag_documents table...');
  try {
    const pool = getSQLPool();
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) AS TotalRecords,
        SUM(CASE WHEN Embedding IS NOT NULL THEN 1 ELSE 0 END) AS RecordsWithEmbedding,
        SUM(CASE WHEN VectorJson IS NOT NULL THEN 1 ELSE 0 END) AS RecordsWithVectorJson
      FROM dbo.[rag_documents]
    `);
    
    const stats = result.recordset[0];
    console.log(`   Total records: ${stats.TotalRecords}`);
    console.log(`   Records with Embedding: ${stats.RecordsWithEmbedding}`);
    console.log(`   Records with VectorJson: ${stats.RecordsWithVectorJson}`);
    
    if (stats.TotalRecords === 0) {
      console.error('❌ Table is empty! Please run ingest first.');
      return;
    }
    
    if (stats.RecordsWithEmbedding === 0 && stats.RecordsWithVectorJson === 0) {
      console.error('❌ No records with embeddings! Please re-ingest.');
      return;
    }
    
    console.log('✅ Table has data\n');
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    return;
  }
  
  // 3. Check API key
  console.log('3️⃣ Checking Gemini API key...');
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY or GOOGLE_API_KEY not found in environment variables');
    console.error('   Set it: $env:GEMINI_API_KEY="your-key" (PowerShell)');
    console.error('   Or: export GEMINI_API_KEY="your-key" (Bash)');
    return;
  }
  console.log('✅ API key found\n');
  
  // 4. Test search
  console.log('4️⃣ Testing RAG search...');
  const testQueries = [
    'Lộ trình Chuyển đổi số đã đồng bộ cùng với danh sách các sáng kiến đề xuất',
    'chuyển đổi số',
    'THIBIDI',
    'các chương trình hành động'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('─'.repeat(60));
    
    try {
      const results = await ragService.searchSimilar(
        query,
        apiKey,
        'rag_documents',
        8 // topK = 8
      );
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} results:`);
        results.forEach((r, idx) => {
          console.log(`\n   ${idx + 1}. File: ${r.fileName}`);
          console.log(`      Page: ${r.pageNumber}`);
          console.log(`      Similarity: ${(r.similarity * 100).toFixed(2)}%`);
          console.log(`      Content preview: ${r.content.substring(0, 150)}...`);
        });
        
        // Check similarity threshold
        const aboveThreshold = results.filter(r => r.similarity >= 0.25);
        console.log(`\n   📊 Results above 0.25 threshold: ${aboveThreshold.length}/${results.length}`);
      } else {
        console.log('⚠️ No results found');
      }
    } catch (error) {
      console.error(`❌ Search failed:`, error.message);
      console.error(`   Stack:`, error.stack?.substring(0, 300));
    }
  }
  
  console.log('\n✅ Test completed!');
}

// Run test
testRAGSearch().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
