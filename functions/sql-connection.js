/**
 * SQL Server Connection Module
 * Handles connection pooling and database operations for TSMay data
 */

// Conditionally load driver based on authentication type
// msnodesqlv8 is for Windows Auth only, regular mssql for SQL Auth
let sql = null;
let driverType = null;

let pool = null;

// #region agent log helper (debug-mode)
function dbg(payload) {
  try {
    fetch('http://127.0.0.1:7244/ingest/44a5992a-d7e5-4a51-ab74-f07a3f705c9f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix-sqlauth',
        timestamp: Date.now(),
        ...payload,
      }),
    }).catch(() => {});
  } catch (_) {}
}
// #endregion

/**
 * Initialize SQL Server connection pool
 * @param {Object} config - SQL Server configuration
 * @returns {Promise<sql.ConnectionPool>}
 */
async function initializeSQLPool(config) {
  if (pool) {
    return pool;
  }

  // Determine if using Windows Authentication
  const useWindowsAuth = !config.user && !config.password && 
                         !process.env.SQL_SERVER_USER && 
                         !process.env.SQL_SERVER_PASSWORD;

  const server = config.server || process.env.SQL_SERVER_HOST;
  const database = config.database || process.env.SQL_SERVER_DATABASE || 'THITHI_AI';
  const port = config.port || parseInt(process.env.SQL_SERVER_PORT || '1433');
  const encrypt = config.encrypt !== false;
  // Default to true for self-signed certificates (common in development)
  // Set SQL_SERVER_TRUST_CERT=false to disable if needed
  const trustServerCertificate = config.trustServerCertificate !== undefined 
    ? config.trustServerCertificate 
    : (process.env.SQL_SERVER_TRUST_CERT !== 'false');

  let sqlConfig;

  dbg({
    hypothesisId: 'H1',
    location: 'sql-connection.js:initializeSQLPool:pre-config',
    message: 'init called',
    data: {
      server,
      database,
      port,
      encrypt,
      trustServerCertificate,
      useWindowsAuth,
      hasUser: !!(config.user || process.env.SQL_SERVER_USER),
      hasPassword: !!(config.password || process.env.SQL_SERVER_PASSWORD),
    },
  });

  // Load appropriate driver based on authentication type
  if (!sql) {
    if (useWindowsAuth) {
      // Use msnodesqlv8 driver for Windows Authentication
      sql = require('mssql/msnodesqlv8');
      driverType = 'msnodesqlv8';
      dbg({
        hypothesisId: 'H1',
        location: 'sql-connection.js:initializeSQLPool:driver-load',
        message: 'Loaded msnodesqlv8 driver for Windows Auth',
        data: { driverType: 'msnodesqlv8', useWindowsAuth: true },
      });
    } else {
      // Use regular mssql driver for SQL Server Authentication
      sql = require('mssql');
      driverType = 'mssql';
      dbg({
        hypothesisId: 'H1',
        location: 'sql-connection.js:initializeSQLPool:driver-load',
        message: 'Loaded mssql driver for SQL Auth',
        data: { driverType: 'mssql', useWindowsAuth: false },
      });
    }
  }

  // Use Windows Authentication if no user/password provided
  if (useWindowsAuth) {
    // Use msnodesqlv8 driver for Windows Authentication
    // Build connection string for Windows Authentication
    let connectionString = `Server=${server}`;
    if (port && port !== 1433) {
      connectionString += `,${port}`;
    }
    connectionString += `;Database=${database}`;
    connectionString += `;Integrated Security=true`;
    connectionString += `;TrustServerCertificate=${trustServerCertificate}`;
    if (encrypt) {
      connectionString += `;Encrypt=true`;
    } else {
      connectionString += `;Encrypt=false`;
    }
    connectionString += `;Connection Timeout=30`;

    sqlConfig = {
      connectionString: connectionString,
      options: {
        enableArithAbort: true,
        requestTimeout: 30000
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };
    console.log('🔐 Using Windows Authentication (Integrated Security)');
    dbg({
      hypothesisId: 'H1',
      location: 'sql-connection.js:initializeSQLPool:windows-auth-config',
      message: 'Windows Auth config created',
      data: { connectionString: connectionString.replace(/Password=[^;]+/gi, 'Password=***') },
    });
  } else {
    // Use SQL Server Authentication
    const user = config.user || process.env.SQL_SERVER_USER;
    const password = config.password || process.env.SQL_SERVER_PASSWORD;
    sqlConfig = {
      user: user,
      password: password,
      server: server,
      database: database,
      port: port,
      options: {
        encrypt: encrypt,
        trustServerCertificate: trustServerCertificate, // Set to true to accept self-signed certificates
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
    console.log('🔐 Using SQL Server Authentication');
    console.log(`🔍 DEBUG: Driver type: ${driverType}, User: ${user}, Server: ${server}:${port}, Database: ${database}`);
    console.log(`🔍 DEBUG: Trust Server Certificate: ${trustServerCertificate}, Encrypt: ${encrypt}`);
    dbg({
      hypothesisId: 'H1',
      location: 'sql-connection.js:initializeSQLPool:sql-auth-config',
      message: 'SQL Auth config created',
      data: {
        server,
        database,
        port,
        user,
        hasPassword: !!password,
        driverType,
      },
    });
  }

  try {
    // #region agent log
    const logData = {
      location: 'sql-connection.js:41',
      message: 'Attempting SQL connection',
      data: {
        server: server,
        database: database,
        port: port,
        authentication: useWindowsAuth ? 'Windows Authentication' : 'SQL Server Authentication',
        user: useWindowsAuth ? null : (sqlConfig.user ? '***' : null),
        hasPassword: useWindowsAuth ? false : !!sqlConfig.password
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'G'
    };
    try {
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      }).catch(() => {});
    } catch (e) {}
    console.log('🔍 DEBUG: Attempting SQL connection', {
      server: server,
      database: database,
      port: port,
      authentication: useWindowsAuth ? 'Windows Authentication' : 'SQL Server Authentication'
    });
    // #endregion
    console.log(`🔍 DEBUG: About to connect with driver: ${driverType}`);
    console.log(`🔍 DEBUG: Config keys: ${Object.keys(sqlConfig).join(', ')}`);
    dbg({
      hypothesisId: 'H1',
      location: 'sql-connection.js:initializeSQLPool:before-connect',
      message: 'About to call sql.connect',
      data: { driverType, useWindowsAuth, configKeys: Object.keys(sqlConfig) },
    });
    pool = await sql.connect(sqlConfig);
    console.log(`✅ DEBUG: Connection successful with driver: ${driverType}`);
    dbg({
      hypothesisId: 'H1',
      location: 'sql-connection.js:initializeSQLPool:after-connect',
      message: 'sql.connect succeeded',
      data: { driverType, hasPool: !!pool },
    });
    // #region agent log
    const successLog = {
      location: 'sql-connection.js:58',
      message: 'SQL connection successful',
      data: { connected: pool?.connected },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'G'
    };
    try {
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successLog)
      }).catch(() => {});
    } catch (e) {}
    // #endregion
    console.log('✅ SQL Server connection pool initialized');
    return pool;
  } catch (error) {
    // Better error serialization for msnodesqlv8 errors
    let errorDetails = {
      message: error.message || String(error),
      code: error.code,
      name: error.name || error.constructor?.name,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
    };

    // Try to extract more details from error object
    try {
      if (error.originalError) {
        errorDetails.originalError = {
          message: error.originalError.message,
          code: error.originalError.code,
          name: error.originalError.name,
        };
      }
      // Check for nested error properties
      const errorKeys = Object.keys(error);
      if (errorKeys.length > 0) {
        errorDetails.allProperties = errorKeys;
        // Try to get string representation of common error properties
        for (const key of ['info', 'number', 'state', 'class', 'serverName', 'procName']) {
          if (error[key] !== undefined) {
            errorDetails[key] = error[key];
          }
        }
      }
    } catch (e) {
      // Ignore errors during error serialization
    }

    // #region agent log
    const errorLog = {
      location: 'sql-connection.js:70',
      message: 'SQL connection failed',
      data: {
        ...errorDetails,
        server: server,
        port: port,
        authentication: useWindowsAuth ? 'Windows Authentication' : 'SQL Server Authentication',
        stack: error.stack?.substring(0, 300)
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'G'
    };
    try {
      fetch('http://127.0.0.1:7243/ingest/5d4a1534-8047-4ce8-ad09-8cd456043831', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorLog)
      }).catch(() => {});
    } catch (e) {}
    // #endregion
    
    console.error('🔍 DEBUG: SQL connection error details');
    console.error('   Error Name:', errorDetails.name || 'Unknown');
    console.error('   Error Message:', errorDetails.message || 'No message');
    console.error('   Error Code:', errorDetails.code || 'No code');
    if (errorDetails.sqlState) console.error('   SQL State:', errorDetails.sqlState);
    if (errorDetails.sqlMessage) console.error('   SQL Message:', errorDetails.sqlMessage);
    if (errorDetails.errno) console.error('   Errno:', errorDetails.errno);
    console.error('   Server:', server);
    console.error('   Port:', port);
    console.error('   Database:', database);
    console.error('   Authentication:', useWindowsAuth ? 'Windows Authentication' : 'SQL Server Authentication');
    console.error('   Driver:', driverType);
    
    if (error.stack) {
      console.error('\n   Stack Trace:');
      console.error(error.stack.split('\n').slice(0, 5).map(line => '   ' + line).join('\n'));
    }

    // Provide troubleshooting tips
    console.error('\n💡 Troubleshooting Tips:');
    if (useWindowsAuth) {
      console.error('   1. Verify SQL Server is running: Get-Service MSSQLSERVER');
      console.error('   2. Check SQL Server Browser is running: Get-Service SQLBrowser');
      console.error('   3. Verify Windows Authentication is enabled in SQL Server');
      console.error('   4. Check if SQL Server allows remote connections');
      console.error('   5. Try using SQL Server Authentication instead:');
      console.error('      $env:SQL_SERVER_USER = "sa"');
      console.error('      $env:SQL_SERVER_PASSWORD = "your-password"');
    } else {
      console.error('   1. Verify SQL Server is running: Get-Service MSSQLSERVER');
      console.error('   2. Check username and password are correct');
      console.error('   3. Verify SQL Server Authentication is enabled');
      console.error('   4. Check firewall allows port', port);
    }
    console.error('   6. Test connection with: sqlcmd -S', server, '-d', database, useWindowsAuth ? '-E' : '-U ' + (config.user || process.env.SQL_SERVER_USER || 'sa'));
    
    dbg({
      hypothesisId: 'H1',
      location: 'sql-connection.js:initializeSQLPool:error',
      message: 'Connection error occurred',
      data: {
        ...errorDetails,
        driverType,
        useWindowsAuth,
        server,
        database,
        port,
      },
    });
    
    // Create a more informative error
    const informativeError = new Error(
      `SQL Server connection failed: ${errorDetails.message || 'Unknown error'}\n` +
      `Server: ${server}:${port}, Database: ${database}, Auth: ${useWindowsAuth ? 'Windows' : 'SQL'}, Driver: ${driverType}`
    );
    informativeError.originalError = error;
    informativeError.details = errorDetails;
    throw informativeError;
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
