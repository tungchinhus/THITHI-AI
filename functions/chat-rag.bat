@echo off
REM ============================================
REM Chat với RAG System
REM ============================================

REM ⚠️ Fallback: Set GEMINI_API_KEY nếu chưa có trong environment
if "%GEMINI_API_KEY%"=="" (
    set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
)

echo.
echo ============================================
echo   RAG Chat
echo ============================================
echo.

REM Kiểm tra GEMINI_API_KEY - Tự động lấy từ Firebase nếu chưa có
if "%GEMINI_API_KEY%"=="" (
    echo ⚠️  GEMINI_API_KEY chưa được set
    echo.
    echo 🔑 Đang thử lấy từ Firebase Secrets...
    echo.
    
    REM Kiểm tra Firebase CLI
    where firebase >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        REM Thử lấy từ Firebase
        for /f "tokens=*" %%i in ('firebase functions:secrets:access GEMINI_API_KEY 2^>nul') do set GEMINI_API_KEY=%%i
        
        if not "%GEMINI_API_KEY%"=="" (
            echo ✅ Đã lấy GEMINI_API_KEY từ Firebase
            echo.
        ) else (
            echo ❌ Không thể lấy GEMINI_API_KEY từ Firebase
            echo.
            echo 💡 Cách khắc phục:
            echo    1. Chạy setup-firebase-secrets.bat trước
            echo    2. Hoặc set thủ công: set GEMINI_API_KEY=AIzaSyCphpZiqdnBaep9B-cC453Tc19a9hWq-cE
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo ❌ Firebase CLI chưa được cài đặt
        echo.
        echo 💡 Cách khắc phục:
        echo    1. Cài Firebase CLI: npm install -g firebase-tools
        echo    2. Hoặc set thủ công: set GEMINI_API_KEY=your_key
        echo.
        pause
        exit /b 1
    )
)

REM Set SQL Server defaults
if "%SQL_SERVER_HOST%"=="" set SQL_SERVER_HOST=localhost
if "%SQL_SERVER_DATABASE%"=="" set SQL_SERVER_DATABASE=THITHI_AI
if "%SQL_SERVER_USER%"=="" set SQL_SERVER_USER=sa
if "%SQL_SERVER_PASSWORD%"=="" set SQL_SERVER_PASSWORD=123456

echo 📋 Configuration:
echo    SQL Server: %SQL_SERVER_HOST%\%SQL_SERVER_DATABASE%
echo    GEMINI_API_KEY: Set ✅
echo.

echo Nhập câu hỏi của bạn:
set /p USER_QUERY=

if "%USER_QUERY%"=="" (
    echo.
    echo ⚠️  Câu hỏi không được để trống
    pause
    exit /b 1
)

echo.
echo 🔍 Đang tìm kiếm: %USER_QUERY%
echo.

REM Tạo temp script để chạy chat
echo const {searchSimilar, generateAnswer, ensureRAGTable} = require('./rag-service'); > temp-chat.js
echo const {initializeSQLPool} = require('./sql-connection'); >> temp-chat.js
echo (async () =^> { >> temp-chat.js
echo   try { >> temp-chat.js
echo     const sqlConfig = { >> temp-chat.js
echo       server: process.env.SQL_SERVER_HOST || 'localhost', >> temp-chat.js
echo       database: process.env.SQL_SERVER_DATABASE || 'THITHI_AI', >> temp-chat.js
echo       port: parseInt(process.env.SQL_SERVER_PORT || '1433'), >> temp-chat.js
echo       encrypt: process.env.SQL_SERVER_ENCRYPT !== 'false', >> temp-chat.js
echo       trustServerCertificate: true >> temp-chat.js
echo     }; >> temp-chat.js
echo     if (process.env.SQL_SERVER_USER) sqlConfig.user = process.env.SQL_SERVER_USER; >> temp-chat.js
echo     if (process.env.SQL_SERVER_PASSWORD) sqlConfig.password = process.env.SQL_SERVER_PASSWORD; >> temp-chat.js
echo     await initializeSQLPool(sqlConfig); >> temp-chat.js
echo     await ensureRAGTable('rag_documents'); >> temp-chat.js
echo     const query = '%USER_QUERY%'; >> temp-chat.js
echo     console.log('🔍 Searching...'); >> temp-chat.js
echo     const contexts = await searchSimilar(query, process.env.GEMINI_API_KEY, 'rag_documents', 4); >> temp-chat.js
echo     if (contexts.length === 0) { >> temp-chat.js
echo       console.log('⚠️  Không tìm thấy thông tin trong tài liệu'); >> temp-chat.js
echo       process.exit(0); >> temp-chat.js
echo     } >> temp-chat.js
echo     console.log('💬 Generating answer...'); >> temp-chat.js
echo     const answer = await generateAnswer(query, contexts, process.env.GEMINI_API_KEY); >> temp-chat.js
echo     console.log('\n✅ Answer:'); >> temp-chat.js
echo     console.log(answer); >> temp-chat.js
echo     console.log('\n📚 Sources:'); >> temp-chat.js
echo     contexts.forEach((ctx, idx) =^> { >> temp-chat.js
echo       console.log(`   ${idx + 1}. ${ctx.fileName}, trang ${ctx.pageNumber} (${(ctx.similarity * 100).toFixed(2)}%%)`); >> temp-chat.js
echo     }); >> temp-chat.js
echo   } catch (error) { >> temp-chat.js
echo     console.error('❌ Error:', error.message); >> temp-chat.js
echo     process.exit(1); >> temp-chat.js
echo   } >> temp-chat.js
echo })(); >> temp-chat.js

node temp-chat.js
set CHAT_RESULT=%ERRORLEVEL%

del temp-chat.js 2>nul

if %CHAT_RESULT% EQU 0 (
    echo.
    echo ============================================
    echo   ✅ Chat thành công!
    echo ============================================
) else (
    echo.
    echo ============================================
    echo   ❌ Chat thất bại
    echo ============================================
    echo.
    echo 💡 Kiểm tra:
    echo    1. Đã ingest folder chưa (chạy ingest-folder.bat)
    echo    2. SQL Server đang chạy
    echo    3. GEMINI_API_KEY đúng
    echo.
)

pause
