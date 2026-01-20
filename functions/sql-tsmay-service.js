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

    // For SQL Server 2025+: Convert embedding array to VECTOR string format
    // Format: '[0.1,0.2,0.3]' which can be CAST to VECTOR type
    let embeddingVectorString = null;
    if (embedding && Array.isArray(embedding) && embedding.length > 0) {
      embeddingVectorString = '[' + embedding.map(v => v.toString()).join(',') + ']';
    }

    // Check if stored procedure supports VECTOR parameter
    // For SQL Server 2025+, we'll use a modified approach
    // Try to use VECTOR parameter if available, otherwise fallback to JSON
    const params = {
      documentId,
      dataJson,
      embeddingJson, // Keep for backward compatibility
      rowIndex,
      originalColumns: originalColumnsJson
    };

    // Add VECTOR parameter if embedding exists (for SQL Server 2025+)
    // Note: The stored procedure needs to be updated to accept VECTOR type
    // For now, we'll use a direct query approach for VECTOR support
    const { getSQLPool, executeQuery } = require('./sql-connection');
    const pool = getSQLPool();
    
    if (pool && embeddingVectorString) {
      // Check if VECTOR column exists
      const checkVectorSql = `
        SELECT COUNT(*) as cnt 
        FROM sys.columns 
        WHERE object_id = OBJECT_ID('TSMay') 
        AND name = 'Embedding'`;
      
      try {
        const checkResult = await executeQuery(checkVectorSql);
        const hasVectorColumn = checkResult.recordset[0]?.cnt > 0;
        
        if (hasVectorColumn) {
          // Use direct query with VECTOR type for SQL Server 2025+
          const upsertSql = `
            IF EXISTS (SELECT 1 FROM TSMay WHERE DocumentId = @documentId)
            BEGIN
              UPDATE TSMay
              SET 
                DataJson = @dataJson,
                Embedding = CAST(@embeddingVector AS VECTOR(384)),
                EmbeddingJson = @embeddingJson,
                RowIndex = @rowIndex,
                OriginalColumns = @originalColumns
              WHERE DocumentId = @documentId;
              SELECT SCOPE_IDENTITY() AS Id;
            END
            ELSE
            BEGIN
              INSERT INTO TSMay (DocumentId, DataJson, Embedding, EmbeddingJson, RowIndex, OriginalColumns)
              VALUES (@documentId, @dataJson, CAST(@embeddingVector AS VECTOR(384)), @embeddingJson, @rowIndex, @originalColumns);
              SELECT SCOPE_IDENTITY() AS Id;
            END`;
          
          const result = await executeQuery(upsertSql, {
            documentId,
            dataJson,
            embeddingVector: embeddingVectorString,
            embeddingJson,
            rowIndex,
            originalColumns: originalColumnsJson
          });
          
          return result.recordset[0]?.Id || null;
        }
      } catch (vectorError) {
        console.warn('⚠️ VECTOR column check failed, using JSON fallback:', vectorError.message);
      }
    }

    // Fallback to stored procedure with JSON (for SQL Server 2022 or when VECTOR not available)
    const result = await executeStoredProcedure('sp_upsert_tsmay', params);
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
 * Detect if question asks for specific field value (e.g., "KVA là 250", "KVA = 250")
 * @param {string} question - User question
 * @returns {Object|null} { field: 'KVA', value: '250' } or null
 */
function detectFieldValueQuery(question) {
  const lowerQuestion = question.toLowerCase();
  
  // Pattern 1: "KVA là 250", "KVA = 250", "KVA 250", "có KVA 250"
  const patterns = [
    /(?:kva|kva\s*=|kva\s*là|kva\s*có|có\s*kva)\s*(\d+)/i,
    /(\d+)\s*(?:kva|kva\s*=|kva\s*là)/i,
    // Pattern 2: "số máy là 212250026", "số máy = 212250026"
    /(?:số\s*máy|so\s*may|số\s*may|so\s*máy)\s*(?:là|=|có)?\s*(\d+)/i,
    /(\d+)\s*(?:số\s*máy|so\s*may)/i,
    // Pattern 3: "SBB là 2130478", "SBB = 2130478"
    /(?:sbb|sbb\s*=|sbb\s*là|có\s*sbb)\s*(\d+)/i,
    /(\d+)\s*(?:sbb|sbb\s*=|sbb\s*là)/i,
  ];
  
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      let field = null;
      let value = match[1] || match[0];
      
      // Determine field name
      if (/kva/i.test(question)) {
        field = 'KVA';
      } else if (/số\s*máy|so\s*may/i.test(question)) {
        field = 'Số máy';
      } else if (/sbb/i.test(question)) {
        field = 'SBB';
      }
      
      if (field && value) {
        return { field, value: value.trim() };
      }
    }
  }
  
  return null;
}

/**
 * Search TSMay data by specific field value (direct SQL query)
 * @param {string} fieldName - Field name (e.g., "KVA", "Số máy")
 * @param {string} fieldValue - Field value to search for
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
async function searchTSMayByFieldValue(fieldName, fieldValue, options = {}) {
  try {
    const { topN = 1000 } = options;
    
    console.log(`🔍 Searching TSMay by field value: ${fieldName} = ${fieldValue}`);
    
    // Query to find records where the field matches the value
    // Need to search in DataJson JSON field
    // Also search in Content field (which contains combined text like "250 - 212250026 - ...")
    // And search in all JSON keys (case-insensitive)
    // Escape field name for SQL injection prevention
    const escapedFieldName = fieldName.replace(/'/g, "''");
    
    let query = `
      SELECT TOP (@topN)
        Id, DocumentId, DataJson, EmbeddingJson, ImportedAt, RowIndex, OriginalColumns, Content
      FROM TSMay
      WHERE (
        -- Search in JSON with original field name (case-insensitive, try different formats)
        JSON_VALUE(DataJson, '$."${escapedFieldName}"') = @fieldValue
        OR JSON_VALUE(DataJson, '$."${escapedFieldName.toUpperCase()}"') = @fieldValue
        OR JSON_VALUE(DataJson, '$."${escapedFieldName.toLowerCase()}"') = @fieldValue
        OR JSON_VALUE(DataJson, '$."${escapedFieldName}"') = CAST(@fieldValue AS INT)
        OR JSON_VALUE(DataJson, '$."${escapedFieldName.toUpperCase()}"') = CAST(@fieldValue AS INT)
        OR JSON_VALUE(DataJson, '$."${escapedFieldName.toLowerCase()}"') = CAST(@fieldValue AS INT)
        -- Also search in Content field (contains combined text like "250 - ...")
        OR (Content IS NOT NULL AND (
          Content LIKE @fieldValuePatternStart
          OR Content LIKE @fieldValuePatternMiddle
        ))
        -- Search in all JSON keys (for sanitized column names like A, B, C...)
        -- This will find the value in any JSON key
        OR EXISTS (
          SELECT 1 
          FROM OPENJSON(DataJson) 
          WHERE [value] = @fieldValue 
             OR [value] = CAST(@fieldValue AS INT)
             OR CAST([value] AS NVARCHAR(MAX)) = @fieldValue
        )
      )
      ORDER BY ImportedAt DESC
    `;
    
    const params = {
      topN,
      fieldValue: fieldValue.toString(),
      fieldValuePatternStart: `${fieldValue} -%`,  // "250 - ..."
      fieldValuePatternMiddle: `% - ${fieldValue} -%`  // "... - 250 - ..."
    };
    
    const result = await executeQuery(query, params);
    const records = result.recordset || [];
    
    // Filter records to ensure the value matches the correct field
    // This is important because Content might contain the value in a different context
    const filteredRecords = records.filter(record => {
      try {
        const data = JSON.parse(record.DataJson || '{}');
        
        // Priority 1: Check if the exact field name matches (case-insensitive)
        for (const key in data) {
          if (key && (
            key.toLowerCase() === fieldName.toLowerCase() ||
            key.toUpperCase() === fieldName.toUpperCase() ||
            key === fieldName
          )) {
            const value = data[key];
            if (value != null) {
              const valueStr = value.toString().trim();
              const fieldValueStr = fieldValue.toString().trim();
              
              // Exact match
              if (valueStr === fieldValueStr) {
                return true;
              }
              
              // Numeric match
              if (!isNaN(value) && !isNaN(fieldValue)) {
                if (parseFloat(value) === parseFloat(fieldValue)) {
                  return true;
                }
              }
            }
          }
        }
        
        // Priority 2: Check Content field if it starts with the value (e.g., "250 - ...")
        // This works for KVA because it's typically the first value in Content
        if (record.Content) {
          const contentTrimmed = record.Content.trim();
          // Check if Content starts with "250 -" (for KVA = 250)
          if (contentTrimmed.startsWith(fieldValue + ' -') || 
              contentTrimmed.startsWith(fieldValue + '-')) {
            // Additional check: if fieldName is KVA and Content starts with the value, it's likely correct
            if (fieldName.toLowerCase() === 'kva') {
              return true;
            }
          }
        }
        
        return false;
      } catch (error) {
        console.warn('Error filtering record:', error);
        // If we can't parse, include it if Content matches (safer)
        if (record.Content && record.Content.trim().startsWith(fieldValue + ' ')) {
          return true;
        }
        return false;
      }
    });
    
    console.log(`✅ Found ${filteredRecords.length} records with ${fieldName} = ${fieldValue} (filtered from ${records.length} total)`);
    
    return {
      records: filteredRecords.map(record => ({
        ...record,
        similarity: 1.0, // Exact match = 100% similarity
        data: JSON.parse(record.DataJson || '{}'),
        originalColumns: record.OriginalColumns ? JSON.parse(record.OriginalColumns) : []
      })),
      totalFound: filteredRecords.length,
      totalRecords: filteredRecords.length
    };
  } catch (error) {
    console.error('❌ Error searching TSMay by field value:', error);
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
    // First, check if this is a field value query (e.g., "KVA là 250")
    const fieldValueQuery = detectFieldValueQuery(question);
    if (fieldValueQuery) {
      console.log(`🔍 Detected field value query: ${fieldValueQuery.field} = ${fieldValueQuery.value}`);
      return await searchTSMayByFieldValue(fieldValueQuery.field, fieldValueQuery.value, options);
    }
    
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

    // Check if VECTOR column exists (SQL Server 2025+)
    const { getSQLPool, executeQuery } = require('./sql-connection');
    const pool = getSQLPool();
    let useNativeVector = false;
    
    if (pool) {
      try {
        const checkVectorSql = `
          SELECT COUNT(*) as cnt 
          FROM sys.columns 
          WHERE object_id = OBJECT_ID('TSMay') 
          AND name = 'Embedding'`;
        const checkResult = await executeQuery(checkVectorSql);
        useNativeVector = checkResult.recordset[0]?.cnt > 0;
      } catch (error) {
        console.warn('⚠️ VECTOR column check failed, using JSON fallback:', error.message);
      }
    }

    let records = [];
    let recordsWithSimilarity = [];

    if (useNativeVector) {
      // SQL Server 2025+: Use native VECTOR_DISTANCE function
      const queryEmbeddingVector = '[' + queryEmbedding.map(v => v.toString()).join(',') + ']';
      
      const searchSql = `
        SELECT TOP (@topN)
          Id,
          DocumentId,
          DataJson,
          EmbeddingJson,
          ImportedAt,
          RowIndex,
          OriginalColumns,
          (1.0 - VECTOR_DISTANCE(Embedding, CAST(@queryEmbedding AS VECTOR(384)), COSINE)) AS Similarity
        FROM TSMay
        WHERE Embedding IS NOT NULL
          AND (1.0 - VECTOR_DISTANCE(Embedding, CAST(@queryEmbedding AS VECTOR(384)), COSINE)) >= @similarityThreshold
          ${filterField ? `AND JSON_VALUE(DataJson, CONCAT('$."', @filterField, '"')) = @filterValue` : ''}
        ORDER BY VECTOR_DISTANCE(Embedding, CAST(@queryEmbedding AS VECTOR(384)), COSINE) ASC`;
      
      const params = {
        queryEmbedding: queryEmbeddingVector,
        similarityThreshold,
        topN: 100
      };
      
      if (filterField && filterValue) {
        params.filterField = filterField;
        params.filterValue = filterValue;
      }
      
      const result = await executeQuery(searchSql, params);
      records = result.recordset || [];
      
      recordsWithSimilarity = records.map(record => ({
        ...record,
        similarity: record.Similarity || 0,
        data: JSON.parse(record.DataJson || '{}'),
        originalColumns: record.OriginalColumns ? JSON.parse(record.OriginalColumns) : []
      }));
    } else {
      // SQL Server 2022 or earlier: Use JSON and calculate in application
      const queryEmbeddingJson = JSON.stringify(queryEmbedding);
      const result = await executeStoredProcedure('sp_search_tsmay_vector', {
        queryEmbeddingJson,
        similarityThreshold,
        topN: 100, // Get more records to calculate similarity
        filterField,
        filterValue
      });

      records = result.recordset || [];

      // Calculate similarity for each record
      recordsWithSimilarity = records.map(record => {
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
    }
    
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

/**
 * Calculate statistics from TSMay data
 * @param {string} calculationType - Type of calculation (mean, median, standardDeviation, variance, min, max, sum)
 * @param {string} fieldName - Field name to calculate (e.g., "kVA", "Po (W)")
 * @param {Object} options - Options including filterField and filterValue
 * @returns {Promise<Object>} Calculation result
 */
async function calculateStatistics(calculationType, fieldName, options = {}) {
  try {
    const { filterField = null, filterValue = null } = options;
    
    console.log(`📊 Calculating ${calculationType} for field "${fieldName}"`, {
      filterField,
      filterValue
    });
    
    // Build query to get records
    let query = `
      SELECT DataJson, Content
      FROM TSMay
      WHERE 1=1
    `;
    
    const params = {};
    
    // Apply filter if specified
    if (filterField && filterValue) {
      // Escape filterField to prevent SQL injection
      const escapedFilterField = filterField.replace(/'/g, "''");
      const filterValueStr = filterValue.toString();
      
      query += ` AND (
        -- Exact match with original field name
        JSON_VALUE(DataJson, '$."${escapedFilterField}"') = @filterValue
        -- Case-insensitive match
        OR JSON_VALUE(DataJson, '$."${escapedFilterField.toUpperCase()}"') = @filterValue
        OR JSON_VALUE(DataJson, '$."${escapedFilterField.toLowerCase()}"') = @filterValue
        -- Match in Content field (for combined text like "250 - 212250026 - 2130478 - ...")
        OR Content LIKE @filterValuePattern
        -- Match in any JSON key-value pair (for sanitized column names)
        OR EXISTS (
          SELECT 1 
          FROM OPENJSON(DataJson) 
          WHERE [key] LIKE @filterFieldPattern 
            AND ([value] = @filterValue OR [value] = CAST(@filterValue AS NVARCHAR(MAX)))
        )
      )`;
      params.filterValue = filterValueStr;
      params.filterValuePattern = `%${filterValueStr}%`;
      params.filterFieldPattern = `%${escapedFilterField}%`;
    }
    
    query += ` ORDER BY ImportedAt DESC`;
    
    const result = await executeQuery(query, params);
    const records = result.recordset || [];
    
    if (records.length === 0) {
      const filterMsg = filterField && filterValue 
        ? ` với ${filterField} = ${filterValue}` 
        : '';
      return {
        result: null,
        formattedResult: `Không tìm thấy dữ liệu nào trong TSMay${filterMsg} để tính toán.`
      };
    }
    
    // Extract field values
    const fieldValues = [];
    let actualFieldName = null;
    
    // If fieldName is not specified, find all numeric fields and use the first priority one
    if (!fieldName && records.length > 0) {
      try {
        const sampleData = JSON.parse(records[0].DataJson || '{}');
        const priorityFields = [
          'kVA', 'kva', 'Po (W)', 'Po', 'Io (%)', 'Io', 
          'Pk75 (W)', 'Pk75', 'Uk75 (%)', 'Uk75',
          'Uñm HV', 'Uđm HV', 'LV', 'Udm HV', 'A', 'G', 'H', 'I'
        ];
        
        // Find priority field first
        for (const priorityField of priorityFields) {
          const foundField = Object.keys(sampleData).find(key => {
            if (!key) return false;
            const keyNormalized = key.toLowerCase().replace(/\s+/g, '');
            const fieldNormalized = priorityField.toLowerCase().replace(/\s+/g, '');
            return keyNormalized === fieldNormalized ||
                   keyNormalized.includes(fieldNormalized) ||
                   fieldNormalized.includes(keyNormalized);
          });
          
          if (foundField) {
            actualFieldName = foundField;
            fieldName = foundField; // Update fieldName for later use
            console.log(`📊 Auto-detected field: ${actualFieldName} (from priority: ${priorityField})`);
            break;
          }
        }
        
        // If no priority field found, find first numeric field
        if (!actualFieldName) {
          for (const key of Object.keys(sampleData)) {
            if (!key) continue;
            const value = sampleData[key];
            if (typeof value === 'number' || 
                (typeof value === 'string' && !isNaN(parseFloat(value.replace(/[^\d.-]/g, ''))))) {
              actualFieldName = key;
              fieldName = key;
              console.log(`📊 Auto-detected numeric field: ${actualFieldName}`);
              break;
            }
          }
        }
        
        if (!actualFieldName) {
          console.warn('⚠️ Could not auto-detect field name. Available fields:', Object.keys(sampleData).slice(0, 10));
        }
      } catch (error) {
        console.warn('Error finding field name:', error);
      }
    }
    
    // Extract values for the field
    // First pass: Find the actual field name by checking all records
    if (!actualFieldName && fieldName) {
      for (const record of records) {
        try {
          const data = JSON.parse(record.DataJson || '{}');
          actualFieldName = Object.keys(data).find(key => {
            if (!key) return false;
            const keyNormalized = key.toLowerCase().replace(/\s+/g, '');
            const fieldNormalized = fieldName.toLowerCase().replace(/\s+/g, '');
            return keyNormalized === fieldNormalized ||
                   keyNormalized.includes(fieldNormalized) ||
                   fieldNormalized.includes(keyNormalized);
          });
          if (actualFieldName) {
            console.log(`📊 Found field "${actualFieldName}" matching "${fieldName}"`);
            break;
          }
        } catch (error) {
          console.warn('Error finding field name:', error);
        }
      }
    }
    
    // Second pass: Extract values
    for (const record of records) {
      try {
        const data = JSON.parse(record.DataJson || '{}');
        
        const fieldToUse = actualFieldName || fieldName;
        if (fieldToUse && data[fieldToUse] != null) {
          const value = data[fieldToUse];
          let numValue = null;
          
          if (typeof value === 'number') {
            numValue = value;
          } else if (typeof value === 'string') {
            // Remove non-numeric characters except decimal point and minus
            const numStr = value.replace(/[^\d.-]/g, '');
            const num = parseFloat(numStr);
            numValue = isNaN(num) ? null : num;
          }
          
          if (numValue !== null) {
            fieldValues.push(numValue);
          }
        }
      } catch (error) {
        console.warn('Error parsing record:', error);
      }
    }
    
    console.log(`📊 Extracted ${fieldValues.length} numeric values from ${records.length} records for field "${actualFieldName || fieldName}"`);
    
    if (fieldValues.length === 0) {
      const filterMsg = filterField && filterValue 
        ? ` với ${filterField} = ${filterValue}` 
        : '';
      const fieldMsg = actualFieldName || fieldName || 'field số';
      return {
        result: null,
        formattedResult: `Không tìm thấy giá trị số hợp lệ nào trong field "${fieldMsg}"${filterMsg} để tính toán.`
      };
    }
    
    // Perform calculation
    let resultValue = null;
    let resultLabel = '';
    
    switch (calculationType) {
      case 'mean':
        resultValue = fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length;
        resultLabel = 'Trung bình';
        break;
      
      case 'median':
        const sorted = [...fieldValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        resultValue = sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2 
          : sorted[mid];
        resultLabel = 'Trung vị';
        break;
      
      case 'standardDeviation':
        const mean = fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length;
        const variance = fieldValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fieldValues.length;
        resultValue = Math.sqrt(variance);
        resultLabel = 'Độ lệch chuẩn';
        break;
      
      case 'variance':
        const mean2 = fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length;
        resultValue = fieldValues.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / fieldValues.length;
        resultLabel = 'Phương sai';
        break;
      
      case 'min':
        resultValue = Math.min(...fieldValues);
        resultLabel = 'Giá trị nhỏ nhất';
        break;
      
      case 'max':
        resultValue = Math.max(...fieldValues);
        resultLabel = 'Giá trị lớn nhất';
        break;
      
      case 'sum':
        resultValue = fieldValues.reduce((sum, val) => sum + val, 0);
        resultLabel = 'Tổng';
        break;
      
      default:
        throw new Error(`Loại tính toán "${calculationType}" chưa được hỗ trợ.`);
    }
    
    // Format result
    const formattedResult = typeof resultValue === 'number' && resultValue % 1 !== 0 
      ? resultValue.toFixed(4) 
      : resultValue.toString();
    
    const filterMsg = filterField && filterValue 
      ? ` (lọc theo ${filterField} = ${filterValue})` 
      : '';
    
    const formattedOutput = `**Kết quả tính toán thống kê từ dữ liệu TSMay:**
    
**${resultLabel}** của field **"${actualFieldName || fieldName}"**${filterMsg}: **${formattedResult}**

**Thông tin:**
- Số lượng bản ghi đã sử dụng: ${fieldValues.length}
- Tổng số bản ghi được kiểm tra: ${records.length}
- Field được tính toán: "${actualFieldName || fieldName}"

${calculationType === 'standardDeviation' ? `
**Giải thích:** Độ lệch chuẩn cho biết mức độ phân tán của dữ liệu. Giá trị càng lớn, dữ liệu càng phân tán.` : ''}
${calculationType === 'mean' ? `
**Giải thích:** Trung bình là giá trị trung bình cộng của tất cả các giá trị.` : ''}
${calculationType === 'median' ? `
**Giải thích:** Trung vị là giá trị ở giữa khi sắp xếp dữ liệu theo thứ tự tăng dần.` : ''}
${calculationType === 'variance' ? `
**Giải thích:** Phương sai là bình phương của độ lệch chuẩn, đo lường mức độ phân tán của dữ liệu.` : ''}`;
    
    return {
      result: resultValue,
      formattedResult: formattedOutput,
      fieldName: actualFieldName || fieldName,
      recordCount: fieldValues.length,
      totalRecords: records.length
    };
  } catch (error) {
    console.error('❌ Error calculating statistics:', error);
    throw error;
  }
}

module.exports = {
  initializeEmbeddingFunctions,
  upsertTSMayRecord,
  generateAndSaveEmbedding,
  searchTSMayWithVector,
  searchTSMayWithText,
  migrateFromFirestore,
  calculateStatistics
};
