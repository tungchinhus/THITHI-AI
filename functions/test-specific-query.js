/**
 * Script để test query cụ thể về "Các sáng kiến cải thiện hiệu suất quản trị và SXKD"
 * Chạy: node test-specific-query.js
 */

const ragService = require('./rag-service');
const {initializeSQLPool, getSQLPool} = require('./sql-connection');

// Try to load dotenv if available
try {
  require('dotenv').config();
} catch (e) {
  console.log('ℹ️ dotenv not found, using system environment variables');
}

async function testSpecificQuery() {
  console.log('🧪 Testing specific query: "Các sáng kiến cải thiện hiệu suất quản trị và SXKD"\n');
  
  // Check environment variables
  const sqlHost = process.env.SQL_SERVER_HOST;
  const sqlDatabase = process.env.SQL_SERVER_DATABASE || 'THITHI_AI';
  const sqlUser = process.env.SQL_SERVER_USER;
  const sqlPassword = process.env.SQL_SERVER_PASSWORD;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!sqlHost || !apiKey) {
    console.error('❌ Missing required environment variables!');
    console.error('   Required: SQL_SERVER_HOST, GEMINI_API_KEY');
    return;
  }
  
  // Initialize SQL pool
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
    }
    
    await initializeSQLPool(sqlConfig);
    console.log('✅ SQL Server connected\n');
  } catch (error) {
    console.error('❌ SQL Server connection failed:', error.message);
    return;
  }
  
  // Test queries với các biến thể khác nhau
  const testQueries = [
    'Các sáng kiến cải thiện hiệu suất quản trị và SXKD',
    'sáng kiến cải thiện hiệu suất quản trị',
    'sáng kiến SXKD',
    'cải thiện hiệu suất quản trị',
    'quản trị và sản xuất kinh doanh',
    'số hóa và tự động hóa các quy trình',
    'giám sát hiệu suất theo thời gian thực'
  ];
  
  console.log('📝 Testing multiple query variations:\n');
  
  for (const query of testQueries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📝 Query: "${query}"`);
    console.log('─'.repeat(80));
    
    try {
      const results = await ragService.searchSimilar(
        query,
        apiKey,
        'rag_documents',
        10 // topK = 10 để xem nhiều kết quả hơn
      );
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} results:\n`);
        
        // Group by similarity ranges
        const highSim = results.filter(r => r.similarity >= 0.3);
        const mediumSim = results.filter(r => r.similarity >= 0.2 && r.similarity < 0.3);
        const lowSim = results.filter(r => r.similarity < 0.2);
        
        console.log(`📊 Similarity distribution:`);
        console.log(`   High (>= 0.3): ${highSim.length} results`);
        console.log(`   Medium (0.2-0.3): ${mediumSim.length} results`);
        console.log(`   Low (< 0.2): ${lowSim.length} results\n`);
        
        // Show top results
        const topResults = results.slice(0, 5);
        topResults.forEach((r, idx) => {
          console.log(`\n   ${idx + 1}. [${r.fileName}, trang ${r.pageNumber}]`);
          console.log(`      Similarity: ${(r.similarity * 100).toFixed(2)}%`);
          console.log(`      Content: ${r.content.substring(0, 200)}...`);
        });
        
        // Check if any results match the threshold used in chat function (0.2)
        const aboveThreshold = results.filter(r => r.similarity >= 0.2);
        console.log(`\n   ✅ Results above 0.2 threshold: ${aboveThreshold.length}/${results.length}`);
        
        if (aboveThreshold.length === 0) {
          console.log(`   ⚠️ WARNING: No results above threshold!`);
          console.log(`   Top similarity: ${(results[0].similarity * 100).toFixed(2)}%`);
        }
      } else {
        console.log('❌ No results found');
      }
    } catch (error) {
      console.error(`❌ Search failed:`, error.message);
      if (error.stack) {
        console.error(`   Stack:`, error.stack.substring(0, 300));
      }
    }
  }
  
  // Also check database content
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 Checking database content...');
  console.log('─'.repeat(80));
  
  try {
    const pool = getSQLPool();
    
    // Check for content containing keywords
    const keywordCheck = await pool.request().query(`
      SELECT TOP 10
        ID,
        FileName,
        PageNumber,
        LEFT(Content, 150) AS ContentPreview,
        CASE WHEN Embedding IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasEmbedding
      FROM dbo.[rag_documents]
      WHERE Content LIKE '%sáng kiến%' 
         OR Content LIKE '%quản trị%'
         OR Content LIKE '%SXKD%'
         OR Content LIKE '%hiệu suất%'
      ORDER BY CreatedAt DESC
    `);
    
    if (keywordCheck.recordset.length > 0) {
      console.log(`\n✅ Found ${keywordCheck.recordset.length} records containing keywords:`);
      keywordCheck.recordset.forEach((r, idx) => {
        console.log(`\n   ${idx + 1}. [${r.FileName}, trang ${r.PageNumber}]`);
        console.log(`      Content: ${r.ContentPreview}...`);
        console.log(`      Has Embedding: ${r.HasEmbedding}`);
      });
    } else {
      console.log('⚠️ No records found containing keywords "sáng kiến", "quản trị", "SXKD", or "hiệu suất"');
    }
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
  
  console.log('\n✅ Test completed!');
}

// Run test
testSpecificQuery().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
