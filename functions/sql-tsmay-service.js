/**
 * TSMay SQL Service
 * Handles TSMay data operations with SQL Server and vector embeddings
 */

const { executeQuery, executeStoredProcedure, cosineSimilarity } = require('./sql-connection');

// These functions will be passed from index.js
let generateEmbeddingFn = null;
let createDocumentTextFn = null;

/**
 * Initialize embedding functions (called from index.js)
 */
function initializeEmbeddingFunctions(generateEmbedding, createDocumentText) {
  generateEmbeddingFn = generateEmbedding;
  createDocumentTextFn = createDocumentText;
}

/**
 * Insert or update TSMay record in SQL Server
 * @param {string} documentId - Firestore document ID
 * @param {Object} data - Document data
 * @param {number[]} embedding - Vector embedding (optional)
 * @param {number} rowIndex - Row index
 * @param {string[]} originalColumns - Original column names
 * @returns {Promise<number>} Record ID
 */
async function upsertTSMayRecord(documentId, data, embedding = null, rowIndex = null, originalColumns = null) {
  try {
    // Convert data to JSON
    const dataJson = JSON.stringify(data);
    const embeddingJson = embedding ? JSON.stringify(embedding) : null;
    const originalColumnsJson = originalColumns ? JSON.stringify(originalColumns) : null;

    const result = await executeStoredProcedure('sp_upsert_tsmay', {
      documentId,
      dataJson,
      embeddingJson,
      rowIndex,
      originalColumns: originalColumnsJson
    });

    return result.recordset[0]?.Id || null;
  } catch (error) {
    console.error('❌ Error upserting TSMay record:', error);
    throw error;
  }
}

/**
 * Generate and save embedding for TSMay record
 * @param {string} documentId - Document ID
 * @param {Object} data - Document data
 * @returns {Promise<void>}
 */
async function generateAndSaveEmbedding(documentId, data) {
  try {
    if (!createDocumentTextFn || !generateEmbeddingFn) {
      throw new Error('Embedding functions not initialized. Call initializeEmbeddingFunctions first.');
    }

    // Create text representation
    const docText = createDocumentTextFn({ _originalData: data, ...data });
    
    if (!docText || docText.trim().length === 0) {
      console.warn(`⚠️ Skipping embedding for document ${documentId}: empty text`);
      return;
    }

    // Generate embedding
    const embedding = await generateEmbeddingFn(docText);
    
    // Update record with embedding
    await upsertTSMayRecord(documentId, data, embedding, null, null);
    
    console.log(`✅ Generated and saved embedding for document ${documentId}`);
  } catch (error) {
    console.error(`❌ Error generating embedding for document ${documentId}:`, error);
    throw error;
  }
}

/**
 * Search TSMay data with vector similarity
 * @param {string} question - User question
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
async function searchTSMayWithVector(question, options = {}) {
  try {
    const {
      similarityThreshold = 0.3,
      topN = 10,
      filterField = null,
      filterValue = null
    } = options;

    if (!generateEmbeddingFn) {
      throw new Error('Embedding functions not initialized. Call initializeEmbeddingFunctions first.');
    }

    // Generate query embedding
    let queryEmbedding = null;
    try {
      queryEmbedding = await generateEmbeddingFn(question);
    } catch (error) {
      console.warn('⚠️ Failed to generate query embedding:', error);
      // Fallback to text search
      return await searchTSMayWithText(question, options);
    }

    // Get records from SQL Server
    const queryEmbeddingJson = JSON.stringify(queryEmbedding);
    const result = await executeStoredProcedure('sp_search_tsmay_vector', {
      queryEmbeddingJson,
      similarityThreshold,
      topN: 100, // Get more records to calculate similarity
      filterField,
      filterValue
    });

    const records = result.recordset || [];

    // Calculate similarity for each record
    const recordsWithSimilarity = records.map(record => {
      let similarity = 0;
      
      if (record.EmbeddingJson) {
        try {
          const recordEmbedding = JSON.parse(record.EmbeddingJson);
          similarity = cosineSimilarity(queryEmbedding, recordEmbedding);
        } catch (error) {
          console.warn('Error parsing embedding for record', record.Id, error);
        }
      }

      return {
        ...record,
        similarity,
        data: JSON.parse(record.DataJson || '{}'),
        originalColumns: record.OriginalColumns ? JSON.parse(record.OriginalColumns) : []
      };
    });

    // Sort by similarity and filter
    recordsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    const filteredRecords = recordsWithSimilarity.filter(r => r.similarity > similarityThreshold);

    return {
      records: filteredRecords.slice(0, topN),
      totalFound: filteredRecords.length,
      totalRecords: records.length
    };
  } catch (error) {
    console.error('❌ Error searching TSMay with vector:', error);
    throw error;
  }
}

/**
 * Search TSMay data with text search (fallback)
 * @param {string} question - User question
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
async function searchTSMayWithText(question, options = {}) {
  try {
    const { topN = 10, filterField = null, filterValue = null } = options;

    let query = `
      SELECT TOP (@topN)
        Id, DocumentId, DataJson, EmbeddingJson, ImportedAt, RowIndex, OriginalColumns
      FROM TSMay
      WHERE 1=1
    `;

    const params = { topN };

    if (filterField && filterValue) {
      query += ` AND JSON_VALUE(DataJson, CONCAT('$."', @filterField, '"')) = @filterValue`;
      params.filterField = filterField;
      params.filterValue = filterValue;
    }

    // Simple text search in JSON (can be improved with full-text search)
    const searchTerms = question.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (searchTerms.length > 0) {
      // Search in JSON data (simplified - can be improved)
      query += ` AND (
        DataJson LIKE @searchTerm1
      `;
      searchTerms.forEach((term, index) => {
        if (index === 0) {
          params.searchTerm1 = `%${term}%`;
        } else {
          query += ` OR DataJson LIKE @searchTerm${index + 1}`;
          params[`searchTerm${index + 1}`] = `%${term}%`;
        }
      });
      query += `)`;
    }

    query += ` ORDER BY ImportedAt DESC`;

    const result = await executeQuery(query, params);
    const records = result.recordset || [];

    return {
      records: records.map(record => ({
        ...record,
        data: JSON.parse(record.DataJson || '{}'),
        originalColumns: record.OriginalColumns ? JSON.parse(record.OriginalColumns) : []
      })),
      totalFound: records.length,
      totalRecords: records.length
    };
  } catch (error) {
    console.error('❌ Error searching TSMay with text:', error);
    throw error;
  }
}

/**
 * Migrate data from Firestore to SQL Server
 * @param {number} limit - Maximum number of records to migrate
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Object>} Migration result
 */
async function migrateFromFirestore(limit = 1000, progressCallback = null) {
  const { db } = require('./index'); // Import Firestore db
  
  try {
    // Get Firestore documents
    const tsMayRef = db.collection('TSMay');
    const snapshot = await tsMayRef.limit(limit).get();

    let migrated = 0;
    let errors = 0;
    const errorsList = [];

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const documentId = doc.id;

        // Extract data (exclude metadata)
        const cleanData = {};
        const originalColumns = data._originalColumns || [];
        const columnMapping = data._columnMapping || {};
        
        // Create reverse mapping
        const reverseMapping = {};
        Object.keys(columnMapping).forEach(originalName => {
          const sanitized = columnMapping[originalName];
          reverseMapping[sanitized] = originalName;
        });

        // Build clean data with original names
        Object.keys(data).forEach(key => {
          if (!key.startsWith('_')) {
            const originalName = reverseMapping[key] || key;
            cleanData[originalName] = data[key];
          }
        });

        // Get embedding if exists
        const embedding = data._embedding || null;

        // Insert/update in SQL Server
        await upsertTSMayRecord(
          documentId,
          cleanData,
          embedding,
          data._rowIndex || null,
          originalColumns
        );

        migrated++;

        if (progressCallback) {
          progressCallback(migrated, snapshot.size);
        }
      } catch (error) {
        errors++;
        errorsList.push(`Document ${doc.id}: ${error.message}`);
        console.error(`❌ Error migrating document ${doc.id}:`, error);
      }
    }

    return {
      migrated,
      errors,
      total: snapshot.size,
      errorsList: errorsList.slice(0, 10)
    };
  } catch (error) {
    console.error('❌ Error migrating from Firestore:', error);
    throw error;
  }
}

module.exports = {
  initializeEmbeddingFunctions,
  upsertTSMayRecord,
  generateAndSaveEmbedding,
  searchTSMayWithVector,
  searchTSMayWithText,
  migrateFromFirestore
};
