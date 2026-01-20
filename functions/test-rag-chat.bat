@echo off
REM ============================================
REM Test Chat với RAG System
REM ============================================

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   RAG Chat Test
echo ============================================
echo.

REM Kiểm tra GEMINI_API_KEY
if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  GEMINI_API_KEY chưa được set, fallback dùng key mặc định
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
    echo ✅ Đã set GEMINI_API_KEY mặc định
    echo.
)

REM Kiểm tra SQL Server config
if "%SQL_SERVER_HOST%"=="" set SQL_SERVER_HOST=localhost
if "%SQL_SERVER_DATABASE%"=="" set SQL_SERVER_DATABASE=THITHI_AI
if "%SQL_SERVER_USER%"=="" set SQL_SERVER_USER=sa
if "%SQL_SERVER_PASSWORD%"=="" set SQL_SERVER_PASSWORD=123456

echo 📋 Configuration:
echo    SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
if not "%GEMINI_API_KEY%"=="" (
    echo    GEMINI_API_KEY: Set ✅ (Length: %GEMINI_API_KEY:~0,20%...)
) else (
    echo    GEMINI_API_KEY: Not set
)
echo.

echo Nhập câu hỏi của bạn (hoặc Enter để dùng câu hỏi mặc định):
set /p USER_QUERY=

if "%USER_QUERY%"=="" (
    set USER_QUERY=TBKT-25140T có công suất bao nhiêu?
    echo ✅ Dùng câu hỏi mặc định: %USER_QUERY%
)

echo.
echo 🔍 Đang tìm kiếm: %USER_QUERY%
echo.

REM Chạy test chat
node -e "const {searchSimilar, generateAnswer, ensureRAGTable} = require('./rag-service'); const {initializeSQLPool, getSQLPool} = require('./sql-connection'); (async () => { try { const sqlConfig = { server: process.env.SQL_SERVER_HOST || 'localhost', database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI', port: parseInt(process.env.SQL_SERVER_PORT || '1433'), encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false', trustServerCertificate: true }; if (process.env.SQL_SERVER_USER) sqlConfig.user = process.env.SQL_SERVER_USER; if (process.env.SQL_SERVER_PASSWORD) sqlConfig.password = process.env.SQL_SERVER_PASSWORD; await initializeSQLPool(sqlConfig); await ensureRAGTable('rag_documents'); const query = '%USER_QUERY%'; console.log('🔍 Searching...'); const contexts = await searchSimilar(query, process.env.GEMINI_API_KEY, 'rag_documents', 4); if (contexts.length === 0) { console.log('⚠️  Không tìm thấy thông tin'); process.exit(0); } console.log('💬 Generating answer...'); const answer = await generateAnswer(query, contexts, process.env.GEMINI_API_KEY); console.log('\n✅ Answer:'); console.log(answer); console.log('\n📚 Sources:'); contexts.forEach((ctx, idx) => { console.log(`   ${idx + 1}. ${ctx.fileName}, trang ${ctx.pageNumber} (${(ctx.similarity * 100).toFixed(2)}%%)`); }); } catch (error) { console.error('❌ Error:', error.message); process.exit(1); } })();"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   ✅ Chat thành công!
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   ❌ Chat thất bại
    echo ============================================
)

echo.
pause
