/**
 * Script để test RAG search với data đã có sẵn trong DB
 * Kiểm tra tại sao không tìm thấy mặc dù vector đã được lưu
 * 
 * Chạy: node test-rag-with-existing-data.js
 */

const ragService = require('./rag-service');
const {initializeSQLPool, getSQLPool} = require('./sql-connection');

// Try to load dotenv if available
try {
  require('dotenv').config();
} catch (e) {
  console.log('ℹ️ dotenv not found, using system environment variables');
}

async function testRAGWithExistingData() {
  console.log('🔍 Testing RAG Search với data đã có sẵn trong DB\n');
  console.log('='.repeat(80));
  
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
  
  const pool = getSQLPool();
  
  // Variables to track available columns
  let tableName = 'dbo.[rag_documents]';
  let hasEmbedding = false;
  let hasVectorJson = false;
  let embeddingColumnName = null;
  
  // Step 1: Kiểm tra data trong DB
  console.log('📊 Step 1: Kiểm tra data trong DB');
  console.log('─'.repeat(80));
  
  try {
    // First, check what columns actually exist in the table
    
    // Try to detect column names
    try {
      const colCheckResult = await pool.request().query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'rag_documents'
      `);
      const columns = colCheckResult.recordset.map(r => r.COLUMN_NAME.toLowerCase());
      console.log(`   📋 Columns found: ${columns.join(', ')}`);
      
      // Check for embedding column (case-insensitive)
      if (columns.some(c => c === 'embedding')) {
        hasEmbedding = true;
        embeddingColumnName = 'embedding';
      } else if (columns.some(c => c === 'Embedding')) {
        hasEmbedding = true;
        embeddingColumnName = 'Embedding';
      }
      
      // Check for VectorJson column
      if (columns.some(c => c === 'vectorjson')) {
        hasVectorJson = true;
      } else if (columns.some(c => c === 'VectorJson')) {
        hasVectorJson = true;
      }
    } catch (e) {
      console.log(`   ⚠️  Could not check columns: ${e.message}`);
      // Assume standard columns exist
      hasEmbedding = true;
      embeddingColumnName = 'Embedding';
    }
    
    // Build query based on available columns
    let statsQuery = `SELECT COUNT(*) AS TotalRecords`;
    if (hasEmbedding) {
      statsQuery += `, SUM(CASE WHEN [${embeddingColumnName}] IS NOT NULL THEN 1 ELSE 0 END) AS RecordsWithEmbedding`;
    }
    if (hasVectorJson) {
      statsQuery += `, SUM(CASE WHEN VectorJson IS NOT NULL THEN 1 ELSE 0 END) AS RecordsWithVectorJson`;
    }
    statsQuery += `, SUM(CASE WHEN Content IS NOT NULL AND LEN(Content) > 0 THEN 1 ELSE 0 END) AS RecordsWithContent`;
    statsQuery += ` FROM ${tableName}`;
    
    const statsResult = await pool.request().query(statsQuery);
    const stats = statsResult.recordset[0];
    
    console.log(`   Total records: ${stats.TotalRecords}`);
    if (hasEmbedding) {
      console.log(`   Records with Embedding: ${stats.RecordsWithEmbedding}`);
    }
    if (hasVectorJson) {
      console.log(`   Records with VectorJson: ${stats.RecordsWithVectorJson}`);
    }
    console.log(`   Records with Content: ${stats.RecordsWithContent}\n`);
    
    if (stats.TotalRecords === 0) {
      console.error('❌ Database is empty!');
      return;
    }
    
    const hasAnyEmbedding = (hasEmbedding && stats.RecordsWithEmbedding > 0) || 
                           (hasVectorJson && stats.RecordsWithVectorJson > 0);
    if (!hasAnyEmbedding) {
      console.error('❌ No records with embeddings!');
      return;
    }
    
    // Check embedding dimension (only if column exists)
    if (hasEmbedding && embeddingColumnName) {
      try {
        const dimResult = await pool.request().query(`
          SELECT COL_LENGTH('dbo.[rag_documents]', '${embeddingColumnName}') AS EmbeddingDimension
        `);
        const dimension = dimResult.recordset[0].EmbeddingDimension;
        console.log(`   Embedding dimension: ${dimension || 'N/A'}\n`);
      } catch (e) {
        console.log(`   ⚠️  Could not check embedding dimension: ${e.message}\n`);
      }
    }
    
    // Show sample records
    let sampleQuery = `SELECT TOP 5 ID`;
    // Try to include common columns if they exist
    try {
      const colCheck = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'rag_documents'
      `);
      const cols = colCheck.recordset.map(r => r.COLUMN_NAME);
      
      // Find actual column names (case-sensitive) and use them with aliases
      const fileNameCol = cols.find(c => c.toLowerCase() === 'filename');
      if (fileNameCol) {
        sampleQuery += `, [${fileNameCol}] AS FileName`;
      }
      const pageNumberCol = cols.find(c => c.toLowerCase() === 'pagenumber');
      if (pageNumberCol) {
        sampleQuery += `, [${pageNumberCol}] AS PageNumber`;
      }
      // Find the actual chunk_index column name (case-sensitive)
      const chunkCol = cols.find(c => c.toLowerCase() === 'chunk_index');
      if (chunkCol) {
        sampleQuery += `, [${chunkCol}] AS ChunkIndex`;
      }
      
      // Use actual column names for Content (case-sensitive)
      const contentCol = cols.find(c => c.toLowerCase() === 'content') || 'Content';
      sampleQuery += `, LEN([${contentCol}]) AS ContentLength, LEFT([${contentCol}], 100) AS ContentPreview`;
    } catch (e) {
      // Use defaults
      sampleQuery += `, FileName, PageNumber`;
      sampleQuery += `, LEN(Content) AS ContentLength, LEFT(Content, 100) AS ContentPreview`;
    }
    if (hasEmbedding && embeddingColumnName) {
      sampleQuery += `, CASE WHEN [${embeddingColumnName}] IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasEmbedding`;
    }
    sampleQuery += ` FROM ${tableName} ORDER BY `;
    
    // Try to use created_at or CreatedAt
    try {
      const colCheck = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'rag_documents' 
        AND COLUMN_NAME IN ('created_at', 'CreatedAt')
      `);
      if (colCheck.recordset.length > 0) {
        sampleQuery += colCheck.recordset[0].COLUMN_NAME + ` DESC`;
      } else {
        sampleQuery += `ID DESC`;
      }
    } catch (e) {
      sampleQuery += `ID DESC`;
    }
    
    const sampleResult = await pool.request().query(sampleQuery);
    
    console.log('   Sample records:');
    sampleResult.recordset.forEach((r, idx) => {
      let recordInfo = `\n   ${idx + 1}. ID: ${r.ID}`;
      if (r.FileName) recordInfo += `, File: ${r.FileName}`;
      if (r.PageNumber !== undefined) recordInfo += `, Page: ${r.PageNumber}`;
      if (r.ChunkIndex !== undefined) recordInfo += `, Chunk: ${r.ChunkIndex}`;
      console.log(recordInfo);
      console.log(`      Content length: ${r.ContentLength || 0} chars`);
      console.log(`      Content preview: ${r.ContentPreview || 'N/A'}...`);
      if (r.HasEmbedding !== undefined) {
        console.log(`      Has Embedding: ${r.HasEmbedding}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    return;
  }
  
  // Step 2: Tìm records có chứa keywords liên quan
  console.log(`\n📊 Step 2: Tìm records có chứa keywords liên quan`);
  console.log('─'.repeat(80));
  
  try {
    // Build query with available columns
    let keywordQuery = `SELECT TOP 10 ID`;
    let contentCol = 'Content'; // Default fallback
    try {
      const colCheck = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'rag_documents'
      `);
      const cols = colCheck.recordset.map(r => r.COLUMN_NAME);
      // Find actual column names (case-sensitive) and use them with aliases
      const fileNameCol = cols.find(c => c.toLowerCase() === 'filename');
      if (fileNameCol) {
        keywordQuery += `, [${fileNameCol}] AS FileName`;
      }
      const pageNumberCol = cols.find(c => c.toLowerCase() === 'pagenumber');
      if (pageNumberCol) {
        keywordQuery += `, [${pageNumberCol}] AS PageNumber`;
      }
      // Use actual column names for Content (case-sensitive)
      contentCol = cols.find(c => c.toLowerCase() === 'content') || 'Content';
    } catch (e) {
      keywordQuery += `, FileName, PageNumber`;
    }
    
    keywordQuery += `, LEFT([${contentCol}], 200) AS ContentPreview`;
    if (hasEmbedding && embeddingColumnName) {
      keywordQuery += `, CASE WHEN [${embeddingColumnName}] IS NOT NULL THEN 'Yes' ELSE 'No' END AS HasEmbedding`;
    }
    keywordQuery += ` FROM ${tableName} WHERE [${contentCol}] LIKE '%sáng kiến%' 
         OR [${contentCol}] LIKE '%quản trị%'
         OR [${contentCol}] LIKE '%SXKD%'
         OR [${contentCol}] LIKE '%hiệu suất%'
         OR [${contentCol}] LIKE '%cải thiện%'`;
    
    // Try to find order by column
    try {
      const colCheck = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'rag_documents' 
        AND COLUMN_NAME IN ('created_at', 'CreatedAt')
      `);
      if (colCheck.recordset.length > 0) {
        keywordQuery += ` ORDER BY ${colCheck.recordset[0].COLUMN_NAME} DESC`;
      } else {
        keywordQuery += ` ORDER BY ID DESC`;
      }
    } catch (e) {
      keywordQuery += ` ORDER BY ID DESC`;
    }
    
    const keywordResult = await pool.request().query(keywordQuery);
    
    if (keywordResult.recordset.length > 0) {
      console.log(`✅ Found ${keywordResult.recordset.length} records containing keywords:\n`);
      keywordResult.recordset.forEach((r, idx) => {
        let recordInfo = `   ${idx + 1}. `;
        if (r.FileName) recordInfo += `[${r.FileName}`;
        if (r.PageNumber !== undefined) recordInfo += `, trang ${r.PageNumber}`;
        if (r.FileName || r.PageNumber !== undefined) recordInfo += `]`;
        console.log(recordInfo);
        console.log(`      Content: ${r.ContentPreview || 'N/A'}...`);
        if (r.HasEmbedding !== undefined) {
          console.log(`      Has Embedding: ${r.HasEmbedding}\n`);
        } else {
          console.log('');
        }
      });
    } else {
      console.log('⚠️ No records found containing keywords');
      console.log('   This might explain why search is not finding results\n');
    }
  } catch (error) {
    console.error('❌ Error searching keywords:', error.message);
  }
  
  // Step 3: Test RAG search với query cụ thể
  console.log(`\n📊 Step 3: Test RAG search với query cụ thể`);
  console.log('─'.repeat(80));
  
  const testQuery = 'Các sáng kiến cải thiện hiệu suất quản trị và SXKD';
  console.log(`\n📝 Query: "${testQuery}"\n`);
  
  try {
    console.log('   Generating query embedding...');
    const results = await ragService.searchSimilar(
      testQuery,
      apiKey,
      'rag_documents',
      15 // topK = 15 để xem nhiều kết quả hơn
    );
    
    if (results && results.length > 0) {
      console.log(`\n✅ Found ${results.length} results:\n`);
      
      // Analyze similarity distribution
      const simScores = results.map(r => r.similarity);
      const maxSim = Math.max(...simScores);
      const minSim = Math.min(...simScores);
      const avgSim = simScores.reduce((a, b) => a + b, 0) / simScores.length;
      
      console.log(`📊 Similarity Statistics:`);
      console.log(`   Min: ${minSim.toFixed(4)}`);
      console.log(`   Max: ${maxSim.toFixed(4)}`);
      console.log(`   Avg: ${avgSim.toFixed(4)}\n`);
      
      // Group by similarity ranges
      const highSim = results.filter(r => r.similarity >= 0.3);
      const mediumSim = results.filter(r => r.similarity >= 0.2 && r.similarity < 0.3);
      const lowSim = results.filter(r => r.similarity < 0.2);
      
      console.log(`📊 Similarity Distribution:`);
      console.log(`   High (>= 0.3): ${highSim.length} results`);
      console.log(`   Medium (0.2-0.3): ${mediumSim.length} results`);
      console.log(`   Low (< 0.2): ${lowSim.length} results\n`);
      
      // Show top 10 results
      console.log(`📋 Top 10 Results:\n`);
      const topResults = results.slice(0, 10);
      topResults.forEach((r, idx) => {
        console.log(`   ${idx + 1}. [${r.fileName}, trang ${r.pageNumber}]`);
        console.log(`      Similarity: ${(r.similarity * 100).toFixed(2)}%`);
        console.log(`      Content: ${r.content.substring(0, 150)}...\n`);
      });
      
      // Check threshold
      const threshold = 0.2;
      const aboveThreshold = results.filter(r => r.similarity >= threshold);
      console.log(`\n✅ Results above ${threshold} threshold: ${aboveThreshold.length}/${results.length}`);
      
      if (aboveThreshold.length === 0) {
        console.log(`\n⚠️ WARNING: No results above threshold!`);
        console.log(`   Top similarity: ${(results[0].similarity * 100).toFixed(2)}%`);
        console.log(`   Consider lowering threshold or improving query\n`);
      } else {
        console.log(`\n✅ Search is working! Found ${aboveThreshold.length} relevant results.\n`);
      }
      
    } else {
      console.log('❌ No results found');
      console.log('   Possible reasons:');
      console.log('   1. Query embedding generation failed');
      console.log('   2. VECTOR_DISTANCE query failed');
      console.log('   3. No matching content in database\n');
    }
  } catch (error) {
    console.error(`❌ Search failed:`, error.message);
    if (error.stack) {
      console.error(`   Stack:`, error.stack.substring(0, 500));
    }
  }
  
  // Step 4: Test với các query variations
  console.log(`\n📊 Step 4: Test với các query variations`);
  console.log('─'.repeat(80));
  
  const variations = [
    'sáng kiến cải thiện hiệu suất',
    'quản trị và SXKD',
    'sáng kiến số',
    'cải thiện hiệu suất quản trị',
    'số hóa và tự động hóa',
    'giám sát hiệu suất'
  ];
  
  for (const query of variations) {
    console.log(`\n📝 Query: "${query}"`);
    try {
      const results = await ragService.searchSimilar(
        query,
        apiKey,
        'rag_documents',
        5
      );
      
      if (results && results.length > 0) {
        const topSim = results[0].similarity;
        const aboveThreshold = results.filter(r => r.similarity >= 0.2).length;
        console.log(`   Top similarity: ${(topSim * 100).toFixed(2)}%`);
        console.log(`   Results above 0.2: ${aboveThreshold}/${results.length}`);
      } else {
        console.log(`   ⚠️ No results`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test completed!');
  console.log('\n💡 Tips:');
  console.log('   - If similarity scores are low, try different query variations');
  console.log('   - If no results above threshold, consider lowering threshold to 0.15');
  console.log('   - Check if content in DB matches what you\'re searching for');
  console.log('   - Consider re-ingesting if embeddings seem incorrect\n');
}

// Run test
testRAGWithExistingData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
