/**
 * RAG Service for Firebase Functions
 * - PDF processing và chunking
 * - Embedding generation với Gemini
 * - Vector storage trong SQL Server 2025
 * - Semantic search với VECTOR_DISTANCE
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const {GoogleGenerativeAI} = require('@google/generative-ai');
const vision = require('@google-cloud/vision');
const {executeQuery, getSQLPool, cosineSimilarity} = require('./sql-connection');
const fsPromises = require('fs/promises');

// Chunking configuration
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;
const EMBEDDING_DIMENSION = 768; // Gemini text-embedding-004 produces 768-dimensional vectors

// Initialize Google Vision API client
let visionClient = null;
function getVisionClient() {
  if (!visionClient) {
    try {
      // Try to use application default credentials or service account key
      visionClient = new vision.ImageAnnotatorClient();
    } catch (error) {
      console.warn('⚠️  Google Vision API client initialization failed:', error.message);
      console.warn('   Make sure GOOGLE_APPLICATION_CREDENTIALS is set or service account key is configured');
    }
  }
  return visionClient;
}

/**
 * Generate embedding vector using Gemini text-embedding-004
 * @param {string} text - Text to embed
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text, apiKey) {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:generateEmbedding:entry',message:'Generating embedding',data:{textLength:text.length,textPreview:text.substring(0,100),hasApiKey:!!apiKey,apiKeyPrefix:apiKey?apiKey.substring(0,10):'none'}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{text: text}],
        },
      }),
    });

    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:generateEmbedding:response',message:'API response received',data:{status:response.status,statusText:response.statusText,ok:response.ok}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      // #region agent log
      try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:generateEmbedding:api-error',message:'API error response',data:{status:response.status,errorText}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
      // #endregion
      throw new Error(`Gemini embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:generateEmbedding:parsed',message:'Response parsed',data:{hasEmbedding:!!data.embedding,hasValues:!!(data.embedding&&data.embedding.values),vectorLength:data.embedding&&data.embedding.values?data.embedding.values.length:0}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    if (data.embedding && data.embedding.values) {
      // #region agent log
      try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:generateEmbedding:success',message:'Embedding generated successfully',data:{vectorLength:data.embedding.values.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
      // #endregion
      return data.embedding.values;
    }
    
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:generateEmbedding:invalid-response',message:'Invalid embedding response',data:{responseKeys:Object.keys(data)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    throw new Error('Invalid embedding response from Gemini');
  } catch (error) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:generateEmbedding:error',message:'Error generating embedding',data:{errorMessage:error.message,errorStack:error.stack}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Split text into chunks with overlap
 * @param {string} text - Text to split
 * @param {number} chunkSize - Size of each chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {Array<{text: string, index: number}>} Array of chunks
 */
function splitIntoChunks(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  // #region agent log
  const trimmedText = text ? text.trim() : '';
  const textPreview = text ? text.substring(0, 200).replace(/[\r\n\t]/g, ' ') : '';
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H6',location:'rag-service.js:splitIntoChunks:entry',message:'Splitting text into chunks',data:{textLength:text?text.length:0,trimmedLength:trimmedText.length,hasText:!!text,textIsEmpty:!text||trimmedText.length===0,textPreview,chunkSize,overlap}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  if (!text || trimmedText.length === 0) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H6',location:'rag-service.js:splitIntoChunks:empty',message:'Empty text after trim, returning empty chunks',data:{originalLength:text?text.length:0,trimmedLength:trimmedText.length,textPreview}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    return [];
  }

  const chunks = [];
  const sentences = text.split(/[.!?\n\n]+/).filter(s => s.trim().length > 0);
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H6',location:'rag-service.js:splitIntoChunks:sentences',message:'Sentences extracted',data:{sentenceCount:sentences.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  
  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++,
      });

      // Start new chunk with overlap
      const overlapText = currentChunk.length > overlap 
        ? currentChunk.substring(currentChunk.length - overlap)
        : currentChunk;
      currentChunk = overlapText + ' ' + trimmedSentence;
    } else {
      if (currentChunk.length > 0) {
        currentChunk += ' ';
      }
      currentChunk += trimmedSentence;
    }
  }

  // Add last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
    });
  }

  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H6',location:'rag-service.js:splitIntoChunks:exit',message:'Chunks created',data:{chunkCount:chunks.length,chunkSizes:chunks.map(c=>c.text.length),totalTextLength:chunks.reduce((sum,c)=>sum+c.text.length,0)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  return chunks;
}

/**
 * Parse DOC/DOCX file to text
 */
async function parseWord(filePath) {
  const result = await mammoth.convertToText({path: filePath});
  return [{
    text: result.value || '',
    pageNumber: 0,
  }];
}

/**
 * Parse Excel to text (CSV per sheet)
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const parts = [];
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parts.push(`Sheet: ${name}\n${csv}`);
  });
  return [{
    text: parts.join('\n\n'),
    pageNumber: 0,
  }];
}

/**
 * Parse text/markdown file
 */
async function parseText(filePath) {
  const text = await fsPromises.readFile(filePath, 'utf8');
  return [{
    text,
    pageNumber: 0,
  }];
}

/**
 * Parse file by extension to page array [{text, pageNumber}]
 */
async function parseFileByType(filePath) {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parseFileByType:entry',message:'Parsing file by type',data:{filePath,fileName:path.basename(filePath),ext:path.extname(filePath).toLowerCase(),fileExists:fs.existsSync(filePath),fileSize:fs.existsSync(filePath)?fs.statSync(filePath).size:0}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (ext === '.pdf') {
    const buffer = await fsPromises.readFile(filePath);
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parseFileByType:pdf-read',message:'PDF file read',data:{filePath,fileName,bufferSize:buffer.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    const result = await parsePDF(buffer, fileName);
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parseFileByType:pdf-parsed',message:'PDF parsed',data:{filePath,fileName,pageCount:result.length,textLength:result[0]?result[0].text.length:0}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    return result;
  }
  if (ext === '.docx' || ext === '.doc') {
    return await parseWord(filePath);
  }
  if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(filePath);
  }
  if (ext === '.txt' || ext === '.md') {
    return await parseText(filePath);
  }

  throw new Error(`Unsupported file type: ${ext} (${fileName})`);
}

/**
 * OCR PDF using Google Vision API
 * Note: Vision API supports PDFs directly via asyncBatchAnnotateFiles
 * For now, we'll use documentTextDetection which works with PDF content
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - File name
 * @returns {Promise<Array<{text: string, pageNumber: number}>>} Array of page texts
 */
async function ocrPDF(pdfBuffer, fileName) {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:ocrPDF:entry',message:'Starting OCR with Google Vision API',data:{fileName,bufferSize:pdfBuffer.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  
  const client = getVisionClient();
  if (!client) {
    throw new Error('Google Vision API client not initialized. Please set GOOGLE_APPLICATION_CREDENTIALS or configure service account key.');
  }

  try {
    // Google Vision API supports PDFs via documentTextDetection
    // The API will process all pages and return combined text
    const [result] = await client.documentTextDetection({
      image: {content: pdfBuffer},
    });

    const fullTextAnnotation = result.fullTextAnnotation;
    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      // #region agent log
      try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:ocrPDF:no-text',message:'OCR returned no text',data:{fileName}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
      // #endregion
      return [{
        text: '',
        pageNumber: 0,
      }];
    }

    const ocrText = fullTextAnnotation.text;
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:ocrPDF:success',message:'OCR completed successfully',data:{fileName,textLength:ocrText.length,textPreview:ocrText.substring(0,200)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion

    console.log(`✅ OCR extracted ${ocrText.length} characters from ${fileName}`);
    return [{
      text: ocrText,
      pageNumber: 0,
    }];
  } catch (error) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:ocrPDF:error',message:'OCR error',data:{fileName,errorMessage:error.message,errorCode:error.code,errorDetails:error.details}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    console.error(`Error OCRing PDF ${fileName}:`, error.message);
    
    // Provide helpful error messages
    if (error.message && error.message.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
      throw new Error(`Google Vision API credentials not configured. Please set GOOGLE_APPLICATION_CREDENTIALS environment variable. See HUONG_DAN_GOOGLE_VISION_OCR.md for setup instructions.`);
    }
    
    throw new Error(`Failed to OCR PDF ${fileName}: ${error.message}`);
  }
}

/**
 * Parse PDF file buffer
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - File name
 * @returns {Promise<Array<{text: string, pageNumber: number}>>} Array of page texts
 */
async function parsePDF(pdfBuffer, fileName) {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parsePDF:entry',message:'Starting PDF parse',data:{fileName,bufferSize:pdfBuffer.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  try {
    const data = await pdfParse(pdfBuffer);
    // #region agent log
    const extractedText = data.text || '';
    const textPreview = extractedText.substring(0, 500).replace(/[\r\n\t]/g, ' ');
    const trimmedText = extractedText.trim();
    const isLikelyScanned = extractedText.length < 100 && (data.numpages || 0) > 0;
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parsePDF:parsed',message:'PDF parsed successfully',data:{fileName,textLength:extractedText.length,trimmedLength:trimmedText.length,hasText:!!data.text,pageCount:data.numpages||0,textPreview,isLikelyScanned}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    
    // Check if PDF is likely scanned (very little text extracted)
    if (isLikelyScanned && trimmedText.length === 0) {
      console.log(`📸 Detected scanned PDF: ${fileName}`);
      console.log(`   Attempting OCR with Google Vision API...`);
      
      try {
        const ocrResult = await ocrPDF(pdfBuffer, fileName);
        if (ocrResult[0] && ocrResult[0].text && ocrResult[0].text.trim().length > 0) {
          console.log(`✅ OCR successful! Extracted ${ocrResult[0].text.length} characters`);
          // #region agent log
          try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parsePDF:ocr-success',message:'OCR succeeded for scanned PDF',data:{fileName,ocrTextLength:ocrResult[0].text.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
          // #endregion
          return ocrResult;
        } else {
          console.warn(`⚠️  OCR returned no text for ${fileName}`);
        }
      } catch (ocrError) {
        console.warn(`⚠️  OCR failed for ${fileName}:`, ocrError.message);
        console.warn(`   Falling back to original text extraction`);
        // #region agent log
        try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parsePDF:ocr-failed',message:'OCR failed, using fallback',data:{fileName,ocrError:ocrError.message}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
        // #endregion
      }
    }
    
    // pdf-parse trả về toàn bộ text, không có page-by-page
    // Nếu cần page-by-page, có thể dùng pdf-lib hoặc pdfjs-dist
    const result = [{
      text: data.text,
      pageNumber: 0, // pdf-parse không trả về page number
    }];
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parsePDF:exit',message:'PDF parse complete',data:{fileName,resultTextLength:result[0].text.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    return result;
  } catch (error) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:parsePDF:error',message:'PDF parse error',data:{fileName,errorMessage:error.message,errorStack:error.stack}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF ${fileName}: ${error.message}`);
  }
}

/**
 * Ensure RAG table exists in SQL Server
 * @param {string} tableName - Table name
 * @returns {Promise<void>}
 */
async function ensureRAGTable(tableName = 'rag_documents') {
  const pool = getSQLPool();
  if (!pool) {
    throw new Error('SQL Server connection pool not initialized');
  }

  // Check SQL Server version
  const versionResult = await pool.request().query(`
    SELECT CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)) AS Version
  `);
  const version = versionResult.recordset[0].Version;
  const versionMajor = parseInt(version.split('.')[0]);
  const hasVectorSupport = versionMajor >= 16; // SQL Server 2025+

  // Create table if not exists
  let createTableSql = '';
  if (hasVectorSupport) {
    createTableSql = `
      IF OBJECT_ID('dbo.[${tableName}]', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.[${tableName}] (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          Content NVARCHAR(MAX) NOT NULL,
          VectorJson NVARCHAR(MAX) NULL,
          Embedding VECTOR(${EMBEDDING_DIMENSION}) NULL,
          FileName NVARCHAR(500) NULL,
          PageNumber INT NULL,
          ChunkIndex INT NULL,
          CreatedAt DATETIME2 DEFAULT GETDATE()
        );
      END;
      
      IF OBJECT_ID('dbo.[${tableName}]', 'U') IS NOT NULL
      BEGIN
        -- Check if Embedding column exists and has correct dimension
        IF COL_LENGTH('dbo.[${tableName}]', 'Embedding') IS NULL
        BEGIN
          -- Add Embedding column if it doesn't exist
          ALTER TABLE dbo.[${tableName}] ADD Embedding VECTOR(${EMBEDDING_DIMENSION}) NULL;
        END;
        
        -- Ensure other columns exist
        IF COL_LENGTH('dbo.[${tableName}]', 'FileName') IS NULL
          ALTER TABLE dbo.[${tableName}] ADD FileName NVARCHAR(500) NULL;
        IF COL_LENGTH('dbo.[${tableName}]', 'PageNumber') IS NULL
          ALTER TABLE dbo.[${tableName}] ADD PageNumber INT NULL;
        IF COL_LENGTH('dbo.[${tableName}]', 'ChunkIndex') IS NULL
          ALTER TABLE dbo.[${tableName}] ADD ChunkIndex INT NULL;
      END;
    `;
  } else {
    createTableSql = `
      IF OBJECT_ID('dbo.[${tableName}]', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.[${tableName}] (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          Content NVARCHAR(MAX) NOT NULL,
          VectorJson NVARCHAR(MAX) NULL,
          FileName NVARCHAR(500) NULL,
          PageNumber INT NULL,
          ChunkIndex INT NULL,
          CreatedAt DATETIME2 DEFAULT GETDATE()
        );
      END
    `;
  }

  await pool.request().query(createTableSql);
  console.log(`✅ RAG table ${tableName} ensured`);
}

/**
 * Recreate RAG table with correct vector dimension
 * Used when dimension mismatch is detected
 */
async function recreateRAGTable(tableName = 'rag_documents') {
  const pool = getSQLPool();
  if (!pool) {
    throw new Error('SQL Server connection pool not initialized');
  }

  console.log(`⚠️ Recreating table ${tableName} with correct vector dimension (${EMBEDDING_DIMENSION})...`);
  
  // Drop and recreate table
  const recreateSql = `
    IF OBJECT_ID('dbo.[${tableName}]', 'U') IS NOT NULL
    BEGIN
      DROP TABLE dbo.[${tableName}];
    END
    
    CREATE TABLE dbo.[${tableName}] (
      ID INT IDENTITY(1,1) PRIMARY KEY,
      Content NVARCHAR(MAX) NOT NULL,
      VectorJson NVARCHAR(MAX) NULL,
      Embedding VECTOR(${EMBEDDING_DIMENSION}) NULL,
      FileName NVARCHAR(500) NULL,
      PageNumber INT NULL,
      ChunkIndex INT NULL,
      CreatedAt DATETIME2 DEFAULT GETDATE()
    );
  `;
  
  await pool.request().query(recreateSql);
  console.log(`✅ Table ${tableName} recreated with VECTOR(${EMBEDDING_DIMENSION})`);
}

/**
 * Insert chunks into database with embeddings
 */
async function insertChunks(chunks, apiKey, tableName = 'rag_documents') {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:insertChunks:entry',message:'Starting chunk insertion',data:{chunkCount:chunks?chunks.length:0,hasApiKey:!!apiKey,tableName}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  if (!chunks || chunks.length === 0) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H6',location:'rag-service.js:insertChunks:empty',message:'No chunks to insert',data:{chunkCount:0}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    return {inserted: 0};
  }

  const pool = getSQLPool();
  if (!pool) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H5',location:'rag-service.js:insertChunks:no-pool',message:'SQL pool not initialized',data:{}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    throw new Error('SQL Server connection pool not initialized');
  }

  const checkVectorResult = await pool.request().query(`
    SELECT COUNT(*) AS HasVector
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.[${tableName}]')
    AND name = 'Embedding'
  `);
  const hasVectorColumn = checkVectorResult.recordset[0].HasVector > 0;
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:insertChunks:vector-check',message:'Vector column check',data:{hasVectorColumn,tableName}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion

  let insertedCount = 0;
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:insertChunks:before-embeddings',message:'Generating embeddings for batch',data:{batchIndex:Math.floor(i/batchSize)+1,totalBatches:Math.ceil(chunks.length/batchSize),batchSize:batch.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion

    const embeddingPromises = batch.map(chunk => generateEmbedding(chunk.text, apiKey));
    const embeddings = await Promise.all(embeddingPromises);
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:insertChunks:after-embeddings',message:'Embeddings generated',data:{batchIndex:Math.floor(i/batchSize)+1,embeddingCount:embeddings.length,embeddingLengths:embeddings.map(e=>e?e.length:0)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = embeddings[j];
      // #region agent log
      try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:insertChunks:before-insert',message:'About to insert chunk',data:{chunkIndex:chunk.chunkIndex,fileName:chunk.fileName,hasEmbedding:!!embedding,embeddingLength:embedding?embedding.length:0,chunkTextLength:chunk.text.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
      // #endregion
      if (!embedding || embedding.length === 0) {
        // #region agent log
        try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H3',location:'rag-service.js:insertChunks:empty-embedding',message:'Empty embedding skipped',data:{chunkIndex:chunk.chunkIndex,fileName:chunk.fileName}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
        // #endregion
        console.warn(`⚠️ Empty embedding for chunk ${chunk.chunkIndex}`);
        continue;
      }

      const vectorJson = JSON.stringify(embedding);
      const vectorString = '[' + embedding.join(',') + ']';

      try {
        if (hasVectorColumn) {
          await pool.request()
            .input('content', chunk.text)
            .input('vectorJson', vectorJson)
            .input('embedding', vectorString)
            .input('fileName', chunk.fileName)
            .input('pageNumber', chunk.pageNumber)
            .input('chunkIndex', chunk.chunkIndex)
            .query(`
              INSERT INTO dbo.[${tableName}] 
              (Content, VectorJson, Embedding, FileName, PageNumber, ChunkIndex)
              VALUES (@content, @vectorJson, CAST(@embedding AS VECTOR(${EMBEDDING_DIMENSION})), @fileName, @pageNumber, @chunkIndex)
            `);
        } else {
          await pool.request()
            .input('content', chunk.text)
            .input('vectorJson', vectorJson)
            .input('fileName', chunk.fileName)
            .input('pageNumber', chunk.pageNumber)
            .input('chunkIndex', chunk.chunkIndex)
            .query(`
              INSERT INTO dbo.[${tableName}] 
              (Content, VectorJson, FileName, PageNumber, ChunkIndex)
              VALUES (@content, @vectorJson, @fileName, @pageNumber, @chunkIndex)
            `);
        }
        insertedCount++;
        // #region agent log
        try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:insertChunks:insert-success',message:'Chunk inserted successfully',data:{chunkIndex:chunk.chunkIndex,fileName:chunk.fileName,insertedCount,totalChunks:chunks.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
        // #endregion
      } catch (error) {
        // #region agent log
        try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:insertChunks:insert-error',message:'Error inserting chunk',data:{chunkIndex:chunk.chunkIndex,fileName:chunk.fileName,errorMessage:error.message,errorCode:error.code,isVectorDimensionError:error.message&&error.message.includes('vector dimensions')}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
        // #endregion
        // Check if error is due to dimension mismatch
        if (error.message && error.message.includes('vector dimensions') && error.message.includes('do not match')) {
          console.log(`⚠️ Vector dimension mismatch detected. Recreating table...`);
          try {
            await recreateRAGTable(tableName);
            // Retry insert after recreating table
            await pool.request()
              .input('content', chunk.text)
              .input('vectorJson', vectorJson)
              .input('embedding', vectorString)
              .input('fileName', chunk.fileName)
              .input('pageNumber', chunk.pageNumber)
              .input('chunkIndex', chunk.chunkIndex)
              .query(`
                INSERT INTO dbo.[${tableName}] 
                (Content, VectorJson, Embedding, FileName, PageNumber, ChunkIndex)
                VALUES (@content, @vectorJson, CAST(@embedding AS VECTOR(${EMBEDDING_DIMENSION})), @fileName, @pageNumber, @chunkIndex)
              `);
            insertedCount++;
            console.log(`✅ Retry insert successful after table recreation`);
          } catch (retryError) {
            // #region agent log
            try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:insertChunks:retry-error',message:'Error after table recreation retry',data:{chunkIndex:chunk.chunkIndex,errorMessage:retryError.message}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
            // #endregion
            console.error(`❌ Error after table recreation:`, retryError.message);
          }
        } else {
          console.error(`❌ Error inserting chunk ${chunk.chunkIndex}:`, error.message);
        }
      }
    }
    console.log(`✅ Inserted ${insertedCount}/${chunks.length} chunks`);
  }

  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:insertChunks:exit',message:'Chunk insertion complete',data:{insertedCount,totalChunks:chunks.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  return {inserted: insertedCount};
}

/**
 * Ingest PDF into SQL Server with embeddings
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - File name
 * @param {string} apiKey - Gemini API key
 * @param {string} tableName - Table name
 * @returns {Promise<{totalChunks: number, totalPages: number}>}
 */
async function ingestPDF(pdfBuffer, fileName, apiKey, tableName = 'rag_documents') {
  try {
    // Ensure table exists
    await ensureRAGTable(tableName);

    // Parse PDF
    console.log(`📄 Parsing PDF: ${fileName}`);
    const pages = await parsePDF(pdfBuffer, fileName);
    
    // Split into chunks
    const allChunks = [];
    for (const page of pages) {
      const chunks = splitIntoChunks(page.text);
      for (const chunk of chunks) {
        allChunks.push({
          text: chunk.text,
          pageNumber: page.pageNumber,
          chunkIndex: chunk.index,
          fileName: fileName,
        });
      }
    }

    console.log(`📦 Split into ${allChunks.length} chunks`);

    // Generate embeddings
    console.log(`🔢 Generating embeddings...`);
    const pool = getSQLPool();
    if (!pool) {
      throw new Error('SQL Server connection pool not initialized');
    }

    // Check if VECTOR column exists
    const checkVectorResult = await pool.request().query(`
      SELECT COUNT(*) AS HasVector
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.[${tableName}]')
      AND name = 'Embedding'
    `);
    const hasVectorColumn = checkVectorResult.recordset[0].HasVector > 0;

    let insertedCount = 0;

    // Process in batches to avoid timeout
    const batchSize = 10;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      
      // Generate embeddings for batch
      const embeddingPromises = batch.map(chunk => generateEmbedding(chunk.text, apiKey));
      const embeddings = await Promise.all(embeddingPromises);

      // Insert into database
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];
        
        if (!embedding || embedding.length === 0) {
          console.warn(`⚠️ Empty embedding for chunk ${chunk.chunkIndex}`);
          continue;
        }

        const vectorJson = JSON.stringify(embedding);
        const vectorString = '[' + embedding.join(',') + ']';

        try {
          if (hasVectorColumn) {
            // Insert with VECTOR column
            await pool.request()
              .input('content', chunk.text)
              .input('vectorJson', vectorJson)
              .input('embedding', vectorString)
              .input('fileName', chunk.fileName)
              .input('pageNumber', chunk.pageNumber)
              .input('chunkIndex', chunk.chunkIndex)
              .query(`
                INSERT INTO dbo.[${tableName}] 
                (Content, VectorJson, Embedding, FileName, PageNumber, ChunkIndex)
                VALUES (@content, @vectorJson, CAST(@embedding AS VECTOR(${EMBEDDING_DIMENSION})), @fileName, @pageNumber, @chunkIndex)
              `);
          } else {
            // Insert only with VectorJson
            await pool.request()
              .input('content', chunk.text)
              .input('vectorJson', vectorJson)
              .input('fileName', chunk.fileName)
              .input('pageNumber', chunk.pageNumber)
              .input('chunkIndex', chunk.chunkIndex)
              .query(`
                INSERT INTO dbo.[${tableName}] 
                (Content, VectorJson, FileName, PageNumber, ChunkIndex)
                VALUES (@content, @vectorJson, @fileName, @pageNumber, @chunkIndex)
              `);
          }
          
          insertedCount++;
        } catch (error) {
          // Check if error is due to dimension mismatch
          if (error.message && error.message.includes('vector dimensions') && error.message.includes('do not match')) {
            console.log(`⚠️ Vector dimension mismatch detected. Recreating table...`);
            try {
              await recreateRAGTable(tableName);
              // Retry insert after recreating table
              if (hasVectorColumn) {
                await pool.request()
                  .input('content', chunk.text)
                  .input('vectorJson', vectorJson)
                  .input('embedding', vectorString)
                  .input('fileName', chunk.fileName)
                  .input('pageNumber', chunk.pageNumber)
                  .input('chunkIndex', chunk.chunkIndex)
                  .query(`
                    INSERT INTO dbo.[${tableName}] 
                    (Content, VectorJson, Embedding, FileName, PageNumber, ChunkIndex)
                    VALUES (@content, @vectorJson, CAST(@embedding AS VECTOR(${EMBEDDING_DIMENSION})), @fileName, @pageNumber, @chunkIndex)
                  `);
              } else {
                await pool.request()
                  .input('content', chunk.text)
                  .input('vectorJson', vectorJson)
                  .input('fileName', chunk.fileName)
                  .input('pageNumber', chunk.pageNumber)
                  .input('chunkIndex', chunk.chunkIndex)
                  .query(`
                    INSERT INTO dbo.[${tableName}] 
                    (Content, VectorJson, FileName, PageNumber, ChunkIndex)
                    VALUES (@content, @vectorJson, @fileName, @pageNumber, @chunkIndex)
                  `);
              }
              insertedCount++;
              console.log(`✅ Retry insert successful after table recreation`);
            } catch (retryError) {
              console.error(`❌ Error after table recreation:`, retryError.message);
            }
          } else {
            console.error(`❌ Error inserting chunk ${chunk.chunkIndex}:`, error.message);
          }
        }
      }

      console.log(`✅ Inserted ${insertedCount}/${allChunks.length} chunks`);
    }

    return {
      totalChunks: insertedCount,
      totalPages: pages.length,
      fileName: fileName,
    };
  } catch (error) {
    console.error('Error ingesting PDF:', error);
    throw error;
  }
}

/**
 * Ingest generic file types (PDF, Word, Excel, TXT, MD)
 */
async function ingestFile(filePath, apiKey, tableName = 'rag_documents') {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:ingestFile:entry',message:'Starting file ingest',data:{filePath,fileName:path.basename(filePath),fileExists:fs.existsSync(filePath),hasApiKey:!!apiKey}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  const fileName = path.basename(filePath);
  console.log(`📁 Processing file: ${fileName}`);

  let pages;
  try {
    pages = await parseFileByType(filePath);
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:ingestFile:after-parse',message:'File parsed successfully',data:{filePath,fileName,pageCount:pages.length,firstPageTextLength:pages[0]?pages[0].text.length:0}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
  } catch (error) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H2',location:'rag-service.js:ingestFile:parse-error',message:'Error parsing file',data:{filePath,fileName,errorMessage:error.message,errorStack:error.stack}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    throw error;
  }

  const allChunks = [];
  for (const page of pages) {
    const chunks = splitIntoChunks(page.text);
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H6',location:'rag-service.js:ingestFile:after-chunk',message:'Chunks created from page',data:{filePath,fileName,pageNumber:page.pageNumber,chunkCount:chunks.length,chunkSizes:chunks.map(c=>c.text.length)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    for (const chunk of chunks) {
      allChunks.push({
        text: chunk.text,
        pageNumber: page.pageNumber,
        chunkIndex: chunk.index,
        fileName,
      });
    }
  }

  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H6',location:'rag-service.js:ingestFile:before-insert',message:'About to insert chunks',data:{filePath,fileName,totalChunks:allChunks.length,chunkTextLengths:allChunks.map(c=>c.text.length)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  console.log(`📦 ${fileName} -> ${allChunks.length} chunks`);
  await insertChunks(allChunks, apiKey, tableName);
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H4',location:'rag-service.js:ingestFile:after-insert',message:'Chunks inserted',data:{filePath,fileName,totalChunks:allChunks.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion

  return {totalChunks: allChunks.length, totalFiles: 1};
}

/**
 * Recursively scan folder for supported files
 */
function scanFolderRecursive(folderPath) {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:scanFolderRecursive:entry',message:'Scanning folder',data:{folderPath,exists:fs.existsSync(folderPath)}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  const supportedExt = ['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.txt', '.md'];
  const results = [];

  try {
    const entries = fs.readdirSync(folderPath, {withFileTypes: true});
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:scanFolderRecursive:readdir',message:'Read directory entries',data:{folderPath,entryCount:entries.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanFolderRecursive(fullPath));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        // #region agent log
        try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:scanFolderRecursive:check-file',message:'Checking file extension',data:{fileName:entry.name,ext,isSupported:supportedExt.includes(ext),fullPath}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
        // #endregion
        if (supportedExt.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (error) {
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:scanFolderRecursive:error',message:'Error reading directory',data:{folderPath,errorMessage:error.message,errorStack:error.stack}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    throw error;
  }
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:scanFolderRecursive:exit',message:'Folder scan complete',data:{folderPath,foundFiles:results.length,fileList:results.map(f=>path.basename(f))}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  return results;
}

/**
 * Ingest all supported files in a folder
 */
async function ingestFolder(folderPath, apiKey, tableName = 'rag_documents') {
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:ingestFolder:entry',message:'Starting folder ingest',data:{folderPath,hasApiKey:!!apiKey,apiKeyLength:apiKey?apiKey.length:0,tableName}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  await ensureRAGTable(tableName);

  const files = scanFolderRecursive(folderPath);
  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:ingestFolder:after-scan',message:'Files found after scan',data:{folderPath,fileCount:files.length,fileList:files.map(f=>path.basename(f))}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  console.log(`📂 Found ${files.length} supported files in folder ${folderPath}`);

  let totalFiles = 0;
  let totalChunks = 0;
  const fileReports = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    // #region agent log
    try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:ingestFolder:before-file',message:'About to process file',data:{filePath,fileName,fileIndex:files.indexOf(filePath)+1,totalFiles:files.length}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
    // #endregion
    try {
      const result = await ingestFile(filePath, apiKey, tableName);
      // #region agent log
      try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:ingestFolder:after-file',message:'File processed successfully',data:{filePath,fileName,totalChunks:result.totalChunks,totalFiles:result.totalFiles}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
      // #endregion
      totalFiles += result.totalFiles;
      totalChunks += result.totalChunks;
      fileReports.push({name: fileName, file: fileName, chunks: result.totalChunks, status: 'success'});
    } catch (error) {
      // #region agent log
      try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:ingestFolder:file-error',message:'Error processing file',data:{filePath,fileName,errorMessage:error.message,errorStack:error.stack}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
      // #endregion
      console.error(`❌ Error ingesting file ${filePath}:`, error.message);
      fileReports.push({name: fileName, file: fileName, error: error.message, status: 'error'});
    }
  }

  // #region agent log
  try{const logPath='c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';const logData={sessionId:'debug-session',runId:'run1',timestamp:Date.now(),hypothesisId:'H1',location:'rag-service.js:ingestFolder:exit',message:'Folder ingest complete',data:{folderPath,totalFiles,totalChunks,fileReports}};fs.appendFileSync(logPath,JSON.stringify(logData)+'\n');}catch(e){}
  // #endregion
  console.log(`✅ Ingested ${totalChunks} chunks from ${totalFiles} files`);
  return {
    totalFiles,
    totalChunks,
    files: fileReports,
  };
}

/**
 * Search similar chunks using vector similarity
 * @param {string} query - Search query
 * @param {string} apiKey - Gemini API key
 * @param {string} tableName - Table name
 * @param {number} topK - Number of results
 * @returns {Promise<Array<{content: string, fileName: string, pageNumber: number, similarity: number}>>}
 */
async function searchSimilar(query, apiKey, tableName = 'rag_documents', topK = 4) {
  try {
    console.log(`🔍 [RAG] Starting searchSimilar:`, {
      query: query.substring(0, 100),
      tableName,
      topK,
      hasApiKey: !!apiKey
    });
    
    // Generate embedding for query
    console.log(`🔍 [RAG] Generating embedding for query...`);
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(query, apiKey);
    } catch (embedError) {
      console.error('❌ [RAG] Embedding generation failed:', embedError.message);
      throw new Error(`Failed to generate query embedding: ${embedError.message}`);
    }
    
    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.error('❌ [RAG] Empty embedding returned');
      throw new Error('Failed to generate query embedding: empty result');
    }
    
    console.log(`✅ [RAG] Embedding generated: ${queryEmbedding.length} dimensions`);

    const pool = getSQLPool();
    if (!pool) {
      console.error('❌ [RAG] SQL pool not initialized');
      throw new Error('SQL Server connection pool not initialized');
    }
    
    console.log(`✅ [RAG] SQL pool available`);

    // Check if table exists and get record count
    let tableExists = false;
    let totalRecords = 0;
    let recordsWithEmbedding = 0;
    
    try {
      const tableCheckResult = await pool.request().query(`
        SELECT COUNT(*) AS TotalRecords
        FROM dbo.[${tableName}]
      `);
      totalRecords = tableCheckResult.recordset[0].TotalRecords;
      tableExists = true;
      console.log(`📊 [RAG] Table ${tableName} exists with ${totalRecords} total records`);
    } catch (tableError) {
      console.error(`❌ [RAG] Table ${tableName} does not exist or error:`, tableError.message);
      throw new Error(`Table ${tableName} does not exist. Please run ingest first.`);
    }
    
    if (totalRecords === 0) {
      console.warn(`⚠️ [RAG] Table ${tableName} is empty`);
      throw new Error(`Table ${tableName} is empty. Please run ingest-folder.bat first to ingest your PDF files.`);
    }
    
    // Check if VECTOR column exists
    const checkVectorResult = await pool.request().query(`
      SELECT COUNT(*) AS HasVector
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.[${tableName}]')
      AND name = 'Embedding'
    `);
    const hasVectorColumn = checkVectorResult.recordset[0].HasVector > 0;
    
    console.log(`📊 [RAG] Vector column check: ${hasVectorColumn ? '✅ exists' : '❌ not found'}`);
    
    // Check records with embedding
    if (hasVectorColumn) {
      const embeddingCountResult = await pool.request().query(`
        SELECT COUNT(*) AS Count
        FROM dbo.[${tableName}]
        WHERE Embedding IS NOT NULL
      `);
      recordsWithEmbedding = embeddingCountResult.recordset[0].Count;
      console.log(`📊 [RAG] Records with Embedding: ${recordsWithEmbedding}/${totalRecords}`);
    } else {
      const vectorJsonCountResult = await pool.request().query(`
        SELECT COUNT(*) AS Count
        FROM dbo.[${tableName}]
        WHERE VectorJson IS NOT NULL
      `);
      recordsWithEmbedding = vectorJsonCountResult.recordset[0].Count;
      console.log(`📊 [RAG] Records with VectorJson: ${recordsWithEmbedding}/${totalRecords}`);
    }
    
    if (recordsWithEmbedding === 0) {
      throw new Error(`No records with embeddings found in ${tableName}. Please re-ingest the documents.`);
    }

    const vectorString = '[' + queryEmbedding.map(v => v.toString()).join(',') + ']';
    let results = [];
    
    console.log(`🔍 [RAG] Starting similarity search with ${recordsWithEmbedding} records...`);

    if (hasVectorColumn) {
      // Try VECTOR_DISTANCE first, fallback to JavaScript if it fails
      try {
        // Use VECTOR_DISTANCE - embed vector directly in query string
        // Parameterized queries don't work with CAST(@param AS VECTOR(...))
        // Vector is safe to embed (not user input, generated from AI)
        const searchSql = `
          SELECT TOP (${topK})
            ID,
            Content,
            FileName,
            PageNumber,
            ChunkIndex,
            (1.0 - VECTOR_DISTANCE(Embedding, CAST('${vectorString}' AS VECTOR(${EMBEDDING_DIMENSION})), 'COSINE')) AS Similarity
          FROM dbo.[${tableName}]
          WHERE Embedding IS NOT NULL
          ORDER BY VECTOR_DISTANCE(Embedding, CAST('${vectorString}' AS VECTOR(${EMBEDDING_DIMENSION})), 'COSINE') ASC
        `;
        
        console.log(`🔍 [RAG] Executing VECTOR_DISTANCE query...`);
        const result = await pool.request().query(searchSql);
        
        console.log(`📊 [RAG] VECTOR_DISTANCE query returned ${result.recordset.length} results`);

        results = result.recordset.map(row => ({
          id: row.ID,
          content: row.Content,
          fileName: row.FileName || 'unknown',
          pageNumber: (row.PageNumber || 0) + 1,
          chunkIndex: row.ChunkIndex || 0,
          similarity: row.Similarity || 0,
        }));
        
        // Log similarity scores
        if (results.length > 0) {
          const simScores = results.map(r => r.similarity);
          console.log(`📊 [RAG] Similarity scores: ${simScores.map(s => s.toFixed(4)).join(', ')}`);
        }
      } catch (vectorError) {
        // Fallback: VECTOR_DISTANCE not working, use JavaScript calculation
        console.warn('⚠️ VECTOR_DISTANCE failed, falling back to JavaScript calculation:', vectorError.message);
        console.log('📊 Using VectorJson for similarity calculation...');
        
        // Check total records first
        const countResult = await pool.request().query(`
          SELECT COUNT(*) AS TotalCount
          FROM dbo.[${tableName}]
        `);
        const totalCount = countResult.recordset[0].TotalCount;
        console.log(`📊 Total records in database: ${totalCount}`);
        
        if (totalCount === 0) {
          throw new Error('Database is empty. Please run ingest-folder.bat first to ingest your PDF files.');
        }

        const allResult = await pool.request().query(`
          SELECT ID, Content, VectorJson, FileName, PageNumber, ChunkIndex
          FROM dbo.[${tableName}]
          WHERE VectorJson IS NOT NULL
        `);

        console.log(`📊 Found ${allResult.recordset.length} records with VectorJson`);
        
        if (allResult.recordset.length === 0) {
          throw new Error('No records with VectorJson found. The data may have been ingested without VectorJson. Please re-ingest the folder.');
        }
        
        const similarities = [];
        for (const row of allResult.recordset) {
          try {
            const vector = JSON.parse(row.VectorJson);
            const similarity = cosineSimilarity(queryEmbedding, vector);
            similarities.push({
              id: row.ID,
              content: row.Content,
              fileName: row.FileName || 'unknown',
              pageNumber: (row.PageNumber || 0) + 1,
              chunkIndex: row.ChunkIndex || 0,
              similarity: similarity,
            });
          } catch (error) {
            console.warn(`⚠️ Error parsing vector for ID ${row.ID}:`, error.message);
          }
        }

        console.log(`📊 Calculated similarity for ${similarities.length} chunks`);
        if (similarities.length > 0) {
          const maxSim = Math.max(...similarities.map(s => s.similarity));
          const minSim = Math.min(...similarities.map(s => s.similarity));
          console.log(`📊 Similarity range: ${minSim.toFixed(4)} - ${maxSim.toFixed(4)}`);
        }

        // Sort by similarity and take top K
        similarities.sort((a, b) => b.similarity - a.similarity);
        results = similarities.slice(0, topK);
        
        console.log(`📊 Returning top ${results.length} results`);
      }
    } else {
      // Fallback: Calculate cosine similarity in JavaScript
      // Check total records first
      const countResult = await pool.request().query(`
        SELECT COUNT(*) AS TotalCount
        FROM dbo.[${tableName}]
      `);
      const totalCount = countResult.recordset[0].TotalCount;
      console.log(`📊 Total records in database: ${totalCount}`);
      
      if (totalCount === 0) {
        throw new Error('Database is empty. Please run ingest-folder.bat first to ingest your PDF files.');
      }

      const allResult = await pool.request().query(`
        SELECT ID, Content, VectorJson, FileName, PageNumber, ChunkIndex
        FROM dbo.[${tableName}]
        WHERE VectorJson IS NOT NULL
      `);

      console.log(`📊 Found ${allResult.recordset.length} records with VectorJson (no VectorColumn)`);
      
      if (allResult.recordset.length === 0) {
        throw new Error('No records with VectorJson found. The data may have been ingested without VectorJson. Please re-ingest the folder.');
      }

      const similarities = [];
      for (const row of allResult.recordset) {
        try {
          const vector = JSON.parse(row.VectorJson);
          const similarity = cosineSimilarity(queryEmbedding, vector);
          similarities.push({
            id: row.ID,
            content: row.Content,
            fileName: row.FileName || 'unknown',
            pageNumber: (row.PageNumber || 0) + 1,
            chunkIndex: row.ChunkIndex || 0,
            similarity: similarity,
          });
        } catch (error) {
          console.warn(`⚠️ Error parsing vector for ID ${row.ID}:`, error.message);
        }
      }

      console.log(`📊 Calculated similarity for ${similarities.length} chunks`);
      if (similarities.length > 0) {
        const maxSim = Math.max(...similarities.map(s => s.similarity));
        const minSim = Math.min(...similarities.map(s => s.similarity));
        console.log(`📊 Similarity range: ${minSim.toFixed(4)} - ${maxSim.toFixed(4)}`);
      }

      // Sort and take top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      results = similarities.slice(0, topK);
      
      console.log(`📊 Returning top ${results.length} results`);
    }

    console.log(`✅ [RAG] Search completed: ${results.length} results`);
    
    if (results.length > 0) {
      console.log(`📊 [RAG] Result summary:`, {
        count: results.length,
        files: [...new Set(results.map(r => r.fileName))],
        similarityRange: `${Math.min(...results.map(r => r.similarity)).toFixed(4)} - ${Math.max(...results.map(r => r.similarity)).toFixed(4)}`
      });
    } else {
      console.warn(`⚠️ [RAG] No results found. Check:`);
      console.warn(`   - Are there records in ${tableName}?`);
      console.warn(`   - Do records have embeddings?`);
      console.warn(`   - Is the query embedding correct?`);
    }
    
    return results;
  } catch (error) {
    console.error('❌ [RAG] Error searching similar:', error.message);
    console.error('   Stack:', error.stack?.substring(0, 500));
    console.error('   Error details:', {
      name: error.name,
      code: error.code,
      message: error.message
    });
    throw error;
  }
}

/**
 * Generate answer using Gemini with context
 * @param {string} query - User query
 * @param {Array} contexts - Context chunks from search
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<string>} Generated answer
 */
async function generateAnswer(query, contexts, apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({model: 'gemini-1.5-flash'});

    // Build context string
    const contextText = contexts.map((ctx, idx) => {
      return `[${ctx.fileName}, trang ${ctx.pageNumber}]: ${ctx.content}`;
    }).join('\n\n');

    const prompt = `Bạn là một trợ lý AI thông minh. Hãy trả lời câu hỏi dựa trên các đoạn văn bản được cung cấp bên dưới.

Context (các đoạn văn bản liên quan):
${contextText}

Câu hỏi: ${query}

Hướng dẫn:
- Chỉ trả lời dựa trên thông tin có trong context
- Nếu không tìm thấy thông tin trong context, hãy nói rõ "Tôi không tìm thấy thông tin này trong tài liệu"
- Trả lời bằng tiếng Việt nếu câu hỏi là tiếng Việt
- Trả lời ngắn gọn, chính xác và dễ hiểu

Câu trả lời:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating answer:', error);
    throw error;
  }
}

module.exports = {
  ingestPDF,
  ingestFolder,
  ingestFile,
  searchSimilar,
  generateAnswer,
  ensureRAGTable,
  recreateRAGTable,
  parseFileByType,
  scanFolderRecursive,
};
