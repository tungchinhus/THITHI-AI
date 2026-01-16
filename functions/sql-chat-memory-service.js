/**
 * Chat Memory SQL Service
 * Handles chat memory operations with SQL Server and vector embeddings
 * For Deep Memory and Context-Aware Intelligent Suggestions
 */

const { executeQuery, executeStoredProcedure, cosineSimilarity } = require('./sql-connection');

// These functions will be passed from index.js
let generateEmbeddingFn = null;

/**
 * Initialize embedding functions (called from index.js)
 */
function initializeEmbeddingFunctions(generateEmbedding) {
  generateEmbeddingFn = generateEmbedding;
}

/**
 * Create or update chat session
 * @param {string} userId - User ID
 * @param {string} title - Session title (optional)
 * @param {string} sessionId - Existing session ID (optional)
 * @returns {Promise<string>} Session ID
 */
async function upsertChatSession(userId, title = null, sessionId = null) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:26',message:'upsertChatSession called',data:{userId,title:title?.substring(0,50),sessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const result = await executeStoredProcedure('sp_upsert_chat_session', {
      sessionId: sessionId || null,
      userId,
      title,
      updateActivity: 1
    });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:33',message:'upsertChatSession result',data:{hasResult:!!result,hasRecordset:!!result?.recordset,recordsetLength:result?.recordset?.length,returnedSessionId:result?.recordset?.[0]?.SessionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    return result.recordset[0]?.SessionId || null;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:36',message:'upsertChatSession error',data:{error:error.message,stack:error.stack?.substring(0,300),name:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.error('❌ Error upserting chat session:', error);
    throw error;
  }
}

/**
 * Save chat message to memory with vector embedding
 * @param {string} userId - User ID
 * @param {string} content - Message content
 * @param {string} contentType - 'user' or 'assistant'
 * @param {string} sessionId - Session ID (optional)
 * @param {Object} metadata - Additional metadata (optional)
 * @returns {Promise<number>} Memory record ID
 */
async function saveChatMemory(userId, content, contentType, sessionId = null, metadata = null) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:51',message:'saveChatMemory called',data:{userId,contentType,contentLength:content.length,hasSessionId:!!sessionId,hasMetadata:!!metadata},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (!generateEmbeddingFn) {
      console.warn('⚠️ Embedding function not initialized, saving without vector');
      return await saveChatMemoryWithoutVector(userId, content, contentType, sessionId, metadata);
    }

    // Generate embedding for content
    let vectorData = null;
    try {
      const embedding = await generateEmbeddingFn(content);
      vectorData = JSON.stringify(embedding);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:61',message:'Embedding generated',data:{embeddingLength:embedding?.length,vectorDataLength:vectorData?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:64',message:'Embedding generation failed',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.warn('⚠️ Failed to generate embedding for chat memory:', error.message);
      // Continue without embedding
    }

    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:70',message:'Calling stored procedure',data:{procedureName:'sp_insert_chat_memory',hasVectorData:!!vectorData,hasMetadata:!!metadataJson},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    const result = await executeStoredProcedure('sp_insert_chat_memory', {
      userId,
      sessionId: sessionId || null,
      content,
      vectorData,
      contentType,
      metadata: metadataJson
    });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:79',message:'Stored procedure result',data:{hasResult:!!result,hasRecordset:!!result?.recordset,recordsetLength:result?.recordset?.length,returnedId:result?.recordset?.[0]?.Id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    return result.recordset[0]?.Id || null;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sql-chat-memory-service.js:82',message:'saveChatMemory error',data:{error:error.message,stack:error.stack?.substring(0,300),name:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('❌ Error saving chat memory:', error);
    throw error;
  }
}

/**
 * Save chat memory without vector embedding (fallback)
 */
async function saveChatMemoryWithoutVector(userId, content, contentType, sessionId = null, metadata = null) {
  try {
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const result = await executeStoredProcedure('sp_insert_chat_memory', {
      userId,
      sessionId: sessionId || null,
      content,
      vectorData: null,
      contentType,
      metadata: metadataJson
    });

    return result.recordset[0]?.Id || null;
  } catch (error) {
    console.error('❌ Error saving chat memory without vector:', error);
    throw error;
  }
}

/**
 * Search chat memory with vector similarity
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of relevant chat memories
 */
async function searchChatMemory(userId, query, options = {}) {
  try {
    const {
      similarityThreshold = 0.3,
      topN = 10,
      sessionId = null,
      contentType = null
    } = options;

    if (!generateEmbeddingFn) {
      console.warn('⚠️ Embedding function not initialized, using text search');
      return await searchChatMemoryWithText(userId, query, options);
    }

    // Generate query embedding
    let queryEmbedding = null;
    try {
      queryEmbedding = await generateEmbeddingFn(query);
    } catch (error) {
      console.warn('⚠️ Failed to generate query embedding:', error);
      return await searchChatMemoryWithText(userId, query, options);
    }

    // Get candidate records from SQL Server
    const queryVectorJson = JSON.stringify(queryEmbedding);
    const result = await executeStoredProcedure('sp_search_chat_memory_vector', {
      userId,
      queryVectorJson,
      similarityThreshold,
      topN: 100, // Get more records to calculate similarity
      sessionId: sessionId || null,
      contentType: contentType || null
    });

    const records = result.recordset || [];

    // Calculate similarity for each record
    const recordsWithSimilarity = records.map(record => {
      let similarity = 0;
      
      if (record.VectorData) {
        try {
          const recordEmbedding = JSON.parse(record.VectorData);
          similarity = cosineSimilarity(queryEmbedding, recordEmbedding);
        } catch (error) {
          console.warn('Error parsing embedding for record', record.Id, error);
        }
      }

      return {
        id: record.Id,
        userId: record.UserId,
        sessionId: record.SessionId,
        content: record.Content,
        contentType: record.ContentType,
        metadata: record.Metadata ? JSON.parse(record.Metadata) : null,
        createdAt: record.CreatedAt,
        similarity
      };
    });

    // Sort by similarity and filter
    recordsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    const filteredRecords = recordsWithSimilarity.filter(r => r.similarity >= similarityThreshold);

    return filteredRecords.slice(0, topN);
  } catch (error) {
    console.error('❌ Error searching chat memory:', error);
    throw error;
  }
}

/**
 * Search chat memory with text search (fallback)
 */
async function searchChatMemoryWithText(userId, query, options = {}) {
  try {
    const { topN = 10, sessionId = null, contentType = null } = options;

    let sqlQuery = `
      SELECT TOP (@topN)
        Id, UserId, SessionId, [Content], ContentType, Metadata, CreatedAt
      FROM ChatMemory
      WHERE UserId = @userId
    `;

    const params = { userId, topN };

    if (sessionId) {
      sqlQuery += ` AND SessionId = @sessionId`;
      params.sessionId = sessionId;
    }

    if (contentType) {
      sqlQuery += ` AND ContentType = @contentType`;
      params.contentType = contentType;
    }

    // Simple text search
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (searchTerms.length > 0) {
      sqlQuery += ` AND ([Content] LIKE @searchTerm1`;
      params.searchTerm1 = `%${searchTerms[0]}%`;
      
      for (let i = 1; i < searchTerms.length && i < 5; i++) {
        sqlQuery += ` OR [Content] LIKE @searchTerm${i + 1}`;
        params[`searchTerm${i + 1}`] = `%${searchTerms[i]}%`;
      }
      sqlQuery += `)`;
    }

    sqlQuery += ` ORDER BY CreatedAt DESC`;

    const result = await executeQuery(sqlQuery, params);
    const records = result.recordset || [];

    return records.map(record => ({
      id: record.Id,
      userId: record.UserId,
      sessionId: record.SessionId,
      content: record.Content,
      contentType: record.ContentType,
      metadata: record.Metadata ? JSON.parse(record.Metadata) : null,
      createdAt: record.CreatedAt,
      similarity: 0.5 // Default similarity for text search
    }));
  } catch (error) {
    console.error('❌ Error searching chat memory with text:', error);
    throw error;
  }
}

/**
 * Get recent chat memory for context
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @returns {Promise<Array>} Array of recent chat memories
 */
async function getRecentChatMemory(userId, options = {}) {
  try {
    const { topN = 50, sessionId = null } = options;

    const result = await executeStoredProcedure('sp_get_recent_chat_memory', {
      userId,
      topN,
      sessionId: sessionId || null
    });

    const records = result.recordset || [];

    return records.map(record => ({
      id: record.Id,
      userId: record.UserId,
      sessionId: record.SessionId,
      content: record.Content,
      contentType: record.ContentType,
      metadata: record.Metadata ? JSON.parse(record.Metadata) : null,
      createdAt: record.CreatedAt
    }));
  } catch (error) {
    console.error('❌ Error getting recent chat memory:', error);
    throw error;
  }
}

/**
 * Get context-aware suggestions based on chat memory
 * @param {string} userId - User ID
 * @param {string} currentQuery - Current user query
 * @param {Object} options - Options
 * @returns {Promise<Array>} Array of suggested queries
 */
async function getContextAwareSuggestions(userId, currentQuery, options = {}) {
  try {
    const { maxSuggestions = 3, sessionId = null } = options;

    // Search for similar past queries
    const similarMemories = await searchChatMemory(userId, currentQuery, {
      similarityThreshold: 0.4,
      topN: 10,
      sessionId,
      contentType: 'user' // Only search user queries
    });

    // Extract suggestions from similar conversations
    const suggestions = [];
    const seen = new Set();

    for (const memory of similarMemories) {
      // Try to extract follow-up questions from metadata or next messages
      if (memory.metadata && memory.metadata.suggestions) {
        for (const suggestion of memory.metadata.suggestions) {
          if (suggestions.length >= maxSuggestions) break;
          if (!seen.has(suggestion.toLowerCase())) {
            suggestions.push(suggestion);
            seen.add(suggestion.toLowerCase());
          }
        }
      }
    }

    // If not enough suggestions, generate based on content patterns
    if (suggestions.length < maxSuggestions) {
      // Analyze common patterns in similar queries
      const commonPatterns = extractCommonPatterns(similarMemories, currentQuery);
      for (const pattern of commonPatterns) {
        if (suggestions.length >= maxSuggestions) break;
        if (!seen.has(pattern.toLowerCase())) {
          suggestions.push(pattern);
          seen.add(pattern.toLowerCase());
        }
      }
    }

    return suggestions.slice(0, maxSuggestions);
  } catch (error) {
    console.error('❌ Error getting context-aware suggestions:', error);
    return [];
  }
}

/**
 * Extract common patterns from similar memories
 */
function extractCommonPatterns(memories, currentQuery) {
  const patterns = [];
  
  // Analyze query type
  const queryLower = currentQuery.toLowerCase();
  
  if (queryLower.includes('hạn mức') || queryLower.includes('định mức')) {
    patterns.push('Xem chi tiết bảng định mức các tỉnh');
    patterns.push('Tải mẫu tờ trình công tác phí');
  } else if (queryLower.includes('quy trình') || queryLower.includes('thủ tục')) {
    patterns.push('Tải mẫu đơn liên quan');
    patterns.push('Xem các bước chi tiết');
  } else if (queryLower.includes('email') || queryLower.includes('thư')) {
    patterns.push('Xem email mới nhất');
    patterns.push('Tìm email từ sếp');
  } else if (queryLower.includes('file') || queryLower.includes('tài liệu')) {
    patterns.push('Tìm file tương tự');
    patterns.push('Xem danh sách file');
  }

  return patterns;
}

module.exports = {
  initializeEmbeddingFunctions,
  upsertChatSession,
  saveChatMemory,
  searchChatMemory,
  getRecentChatMemory,
  getContextAwareSuggestions
};
