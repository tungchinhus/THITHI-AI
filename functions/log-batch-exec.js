/**
 * Script để log batch file execution
 */
const fs = require('fs');
const path = require('path');

const logPath = 'c:\\MyData\\projects\\THITHI\\THIHI_AI\\.cursor\\debug.log';

function log(message, data = {}) {
  try {
    const logData = {
      sessionId: 'debug-session',
      runId: 'batch-debug',
      timestamp: Date.now(),
      hypothesisId: 'H1',
      location: 'log-batch-exec.js',
      message,
      data
    };
    fs.appendFileSync(logPath, JSON.stringify(logData) + '\n');
  } catch (e) {
    // Ignore
  }
}

// Log script start
log('Batch wrapper script started', {
  nodeVersion: process.version,
  cwd: process.cwd(),
  envKeys: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('SQL') || k.includes('FOLDER')).join(',')
});

// Log before running test-folder-ingest.js
log('About to require test-folder-ingest.js', {
  fileExists: fs.existsSync('test-folder-ingest.js')
});

// Run the actual script
require('./test-folder-ingest.js');

log('Batch wrapper script completed');
