/**
 * Test Script cho RAG System
 * 
 * Cách sử dụng:
 * 1. Set environment variables:
 *    export GEMINI_API_KEY="your_key"
 *    export SQL_SERVER_HOST="localhost"
 *    export SQL_SERVER_DATABASE="THITHI_AI"
 * 
 * 2. Chạy test:
 *    node test-rag.js
 */

const fs = require('fs');
const path = require('path');
const {ingestPDF, searchSimilar, generateAnswer, ensureRAGTable} = require('./rag-service');
const {initializeSQLPool, getSQLPool} = require('./sql-connection');

// Configuration
const TEST_PDF_PATH = './test-document.pdf'; // Đặt file PDF test vào đây
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SQL_CONFIG = {
  server: process.env.SQL_SERVER_HOST || 'localhost',
  database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI',
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false',
  trustServerCertificate: true,
};

if (process.env.SQL_SERVER_USER) {
  SQL_CONFIG.user = process.env.SQL_SERVER_USER;
}
if (process.env.SQL_SERVER_PASSWORD) {
  SQL_CONFIG.password = process.env.SQL_SERVER_PASSWORD;
}

/**
 * Test 1: Ingest PDF
 */
async function testIngest() {
  console.log('\n📥 TEST 1: Ingest PDF');
  console.log('='.repeat(50));

  try {
    // Check if PDF file exists
    if (!fs.existsSync(TEST_PDF_PATH)) {
      console.error(`❌ PDF file not found: ${TEST_PDF_PATH}`);
      console.log('💡 Tạo file PDF test hoặc đổi đường dẫn TEST_PDF_PATH');
      return false;
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(TEST_PDF_PATH);
    const fileName = path.basename(TEST_PDF_PATH);

    console.log(`📄 Reading PDF: ${fileName} (${pdfBuffer.length} bytes)`);

    // Ingest PDF
    console.log('⏳ Ingesting PDF...');
    const result = await ingestPDF(
      pdfBuffer,
      fileName,
      GEMINI_API_KEY,
      'rag_documents'
    );

    console.log('✅ Ingest successful!');
    console.log(`   - Total chunks: ${result.totalChunks}`);
    console.log(`   - Total pages: ${result.totalPages}`);
    console.log(`   - File name: ${result.fileName}`);

    return true;
  } catch (error) {
    console.error('❌ Ingest failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Search similar chunks
 */
async function testSearch() {
  console.log('\n🔍 TEST 2: Search Similar Chunks');
  console.log('='.repeat(50));

  const testQueries = [
    'Máy bơm có công suất bao nhiêu?',
    'Thông số kỹ thuật',
    'Hướng dẫn sử dụng',
  ];

  for (const query of testQueries) {
    try {
      console.log(`\n🔎 Query: "${query}"`);
      console.log('⏳ Searching...');

      const results = await searchSimilar(
        query,
        GEMINI_API_KEY,
        'rag_documents',
        3 // top 3 results
      );

      if (results.length === 0) {
        console.log('⚠️  No results found');
        continue;
      }

      console.log(`✅ Found ${results.length} results:`);
      results.forEach((result, idx) => {
        console.log(`\n   ${idx + 1}. File: ${result.fileName}, Page: ${result.pageNumber}`);
        console.log(`      Similarity: ${(result.similarity * 100).toFixed(2)}%`);
        console.log(`      Preview: ${result.content.substring(0, 100)}...`);
      });
    } catch (error) {
      console.error(`❌ Search failed for "${query}":`, error.message);
    }
  }
}

/**
 * Test 3: Chat với RAG
 */
async function testChat() {
  console.log('\n💬 TEST 3: Chat với RAG System');
  console.log('='.repeat(50));

  const testQueries = [
    'Máy bơm có công suất bao nhiêu?',
    'Hãy tóm tắt thông tin về sản phẩm',
    'Có những tính năng gì?',
  ];

  for (const query of testQueries) {
    try {
      console.log(`\n❓ Question: "${query}"`);
      console.log('⏳ Processing...');

      // Search similar chunks
      const contexts = await searchSimilar(
        query,
        GEMINI_API_KEY,
        'rag_documents',
        4
      );

      if (contexts.length === 0) {
        console.log('⚠️  No context found, cannot generate answer');
        continue;
      }

      // Generate answer
      const answer = await generateAnswer(query, contexts, GEMINI_API_KEY);

      console.log(`\n✅ Answer:`);
      console.log(`   ${answer}`);
      console.log(`\n📚 Sources (${contexts.length}):`);
      contexts.forEach((ctx, idx) => {
        console.log(`   ${idx + 1}. ${ctx.fileName}, trang ${ctx.pageNumber} (${(ctx.similarity * 100).toFixed(2)}%)`);
      });
    } catch (error) {
      console.error(`❌ Chat failed for "${query}":`, error.message);
    }
  }
}

/**
 * Test 4: Kiểm tra database
 */
async function testDatabase() {
  console.log('\n🗄️  TEST 4: Kiểm tra Database');
  console.log('='.repeat(50));

  try {
    const pool = getSQLPool();
    if (!pool) {
      console.error('❌ SQL Server connection pool not initialized');
      return false;
    }

    // Count documents
    const countResult = await pool.request().query(`
      SELECT COUNT(*) AS TotalChunks
      FROM dbo.[rag_documents]
    `);
    const totalChunks = countResult.recordset[0].TotalChunks;

    console.log(`✅ Total chunks in database: ${totalChunks}`);

    // Check if VECTOR column exists
    const vectorResult = await pool.request().query(`
      SELECT COUNT(*) AS HasVector
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.[rag_documents]')
      AND name = 'Embedding'
    `);
    const hasVector = vectorResult.recordset[0].HasVector > 0;

    console.log(`✅ VECTOR column: ${hasVector ? 'Yes (SQL Server 2025+)' : 'No (using VectorJson)'}`);

    // Sample documents
    const sampleResult = await pool.request().query(`
      SELECT TOP 3
        ID, FileName, PageNumber, ChunkIndex,
        LEN(Content) AS ContentLength,
        CASE WHEN Embedding IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasEmbedding
      FROM dbo.[rag_documents]
      ORDER BY ID DESC
    `);

    console.log(`\n📋 Sample documents (latest 3):`);
    sampleResult.recordset.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ID: ${row.ID}, File: ${row.FileName}, Page: ${row.PageNumber}`);
      console.log(`      Content: ${row.ContentLength} chars, Embedding: ${row.HasEmbedding}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 RAG System Test Suite');
  console.log('='.repeat(50));

  // Check prerequisites
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    console.log('💡 Set it: export GEMINI_API_KEY="your_key"');
    process.exit(1);
  }

  console.log('✅ GEMINI_API_KEY: Set');
  console.log(`✅ SQL Server: ${SQL_CONFIG.server}:${SQL_CONFIG.port}/${SQL_CONFIG.database}`);

  try {
    // Initialize SQL connection
    console.log('\n🔌 Initializing SQL Server connection...');
    const {initializeSQLPool} = require('./sql-connection');
    await initializeSQLPool(SQL_CONFIG);
    console.log('✅ SQL Server connected');

    // Ensure table exists
    await ensureRAGTable('rag_documents');

    // Run tests
    const ingestSuccess = await testIngest();
    
    if (ingestSuccess) {
      await testDatabase();
      await testSearch();
      await testChat();
    } else {
      console.log('\n⚠️  Skipping search/chat tests (ingest failed)');
    }

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testIngest,
  testSearch,
  testChat,
  testDatabase,
  runTests,
};
