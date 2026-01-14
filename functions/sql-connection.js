/**
 * SQL Server Connection Module
 * Handles connection pooling and database operations for TSMay data
 */

const sql = require('mssql');

let pool = null;

/**
 * Initialize SQL Server connection pool
 * @param {Object} config - SQL Server configuration
 * @returns {Promise<sql.ConnectionPool>}
 */
async function initializeSQLPool(config) {
  if (pool) {
    return pool;
  }

  const sqlConfig = {
    user: config.user || process.env.SQL_SERVER_USER,
    password: config.password || process.env.SQL_SERVER_PASSWORD,
    server: config.server || process.env.SQL_SERVER_HOST,
    database: config.database || process.env.SQL_SERVER_DATABASE || 'THITHI_AI',
    port: config.port || parseInt(process.env.SQL_SERVER_PORT || '1433'),
    options: {
      encrypt: config.encrypt !== false, // Use encryption by default (Azure SQL requires this)
      trustServerCertificate: config.trustServerCertificate || false,
      enableArithAbort: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  try {
    pool = await sql.connect(sqlConfig);
    console.log('✅ SQL Server connection pool initialized');
    return pool;
  } catch (error) {
    console.error('❌ Error initializing SQL Server connection:', error);
    throw error;
  }
}

/**
 * Get SQL Server connection pool
 * @returns {sql.ConnectionPool|null}
 */
function getSQLPool() {
  return pool;
}

/**
 * Close SQL Server connection pool
 */
async function closeSQLPool() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('✅ SQL Server connection pool closed');
  }
}

/**
 * Execute SQL query
 * @param {string} query - SQL query string
 * @param {Object} params - Query parameters
 * @returns {Promise<sql.IResult<any>>}
 */
async function executeQuery(query, params = {}) {
  if (!pool) {
    throw new Error('SQL Server connection pool not initialized');
  }

  const request = pool.request();
  
  // Add parameters
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value === null || value === undefined) {
      request.input(key, sql.NVarChar, null);
    } else if (typeof value === 'number') {
      request.input(key, sql.Float, value);
    } else if (typeof value === 'boolean') {
      request.input(key, sql.Bit, value);
    } else {
      request.input(key, sql.NVarChar, value);
    }
  });

  try {
    const result = await request.query(query);
    return result;
  } catch (error) {
    console.error('❌ SQL query error:', error);
    throw error;
  }
}

/**
 * Execute stored procedure
 * @param {string} procedureName - Stored procedure name
 * @param {Object} params - Procedure parameters
 * @returns {Promise<sql.IResult<any>>}
 */
async function executeStoredProcedure(procedureName, params = {}) {
  if (!pool) {
    throw new Error('SQL Server connection pool not initialized');
  }

  const request = pool.request();
  
  // Add parameters
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value === null || value === undefined) {
      request.input(key, sql.NVarChar, null);
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        request.input(key, sql.Int, value);
      } else {
        request.input(key, sql.Float, value);
      }
    } else if (typeof value === 'boolean') {
      request.input(key, sql.Bit, value);
    } else {
      request.input(key, sql.NVarChar, value);
    }
  });

  try {
    const result = await request.execute(procedureName);
    return result;
  } catch (error) {
    console.error(`❌ Stored procedure ${procedureName} error:`, error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} Cosine similarity (0-1)
 */
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

module.exports = {
  initializeSQLPool,
  getSQLPool,
  closeSQLPool,
  executeQuery,
  executeStoredProcedure,
  cosineSimilarity
};
