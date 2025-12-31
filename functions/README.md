# Firebase Functions - THITHI AI Chat

## Cấu trúc

- `index.js` - Main file chứa các Functions
- `package.json` - Dependencies và scripts
- `.eslintrc.js` - ESLint configuration

## Functions

### 1. `chatFunction`

Function chính xử lý câu hỏi từ người dùng.

**Endpoint:** `https://REGION-PROJECT_ID.cloudfunctions.net/chatFunction`

**Method:** POST

**Request Body:**
```json
{
  "question": "Câu hỏi của người dùng"
}
```

**Response:**
```json
{
  "answer": "Câu trả lời từ AI",
  "sources": ["file1.pdf", "file2.pdf"]
}
```

### 2. `healthCheck`

Function kiểm tra trạng thái service.

**Endpoint:** `https://REGION-PROJECT_ID.cloudfunctions.net/healthCheck`

**Method:** GET

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-30T...",
  "service": "THITHI AI Chat Function"
}
```

## Tích hợp AI Service

### Option 1: Google Gemini

1. Cài đặt package:
```bash
npm install @google/generative-ai
```

2. Thêm vào `index.js`:
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.chatFunction = onRequest(
  { cors: true, maxInstances: 10 },
  async (req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const { question } = req.body;
      if (!question || typeof question !== 'string' || question.trim() === '') {
        return res.status(400).json({ error: 'Question is required' });
      }

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(question);
        const answer = result.response.text();

        return res.status(200).json({
          answer: answer,
          sources: []
        });
      } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'AI service error', message: error.message });
      }
    });
  }
);
```

3. Set environment variable:
```bash
firebase functions:config:set gemini.api_key="YOUR_API_KEY"
```

### Option 2: OpenAI

1. Cài đặt package:
```bash
npm install openai
```

2. Thêm vào `index.js`:
```javascript
const OpenAI = require('openai');

exports.chatFunction = onRequest(
  { cors: true, maxInstances: 10 },
  async (req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const { question } = req.body;
      if (!question || typeof question !== 'string' || question.trim() === '') {
        return res.status(400).json({ error: 'Question is required' });
      }

      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: question }],
          model: 'gpt-3.5-turbo',
        });

        const answer = completion.choices[0].message.content;

        return res.status(200).json({
          answer: answer,
          sources: []
        });
      } catch (error) {
        console.error('OpenAI API Error:', error);
        return res.status(500).json({ error: 'AI service error', message: error.message });
      }
    });
  }
);
```

3. Set environment variable:
```bash
firebase functions:config:set openai.api_key="YOUR_API_KEY"
```

### Option 3: RAG (Retrieval Augmented Generation)

Để tích hợp RAG, bạn cần:

1. Vector database (Pinecone, Weaviate, hoặc Firebase Firestore với vector search)
2. Embedding model (OpenAI embeddings, hoặc Google embeddings)
3. Tìm kiếm tài liệu liên quan
4. Gửi context + question đến AI model

Ví dụ flow:
```javascript
// 1. Tạo embedding cho question
const questionEmbedding = await createEmbedding(question);

// 2. Tìm kiếm tài liệu liên quan
const relevantDocs = await vectorSearch(questionEmbedding, topK: 5);

// 3. Tạo context từ documents
const context = relevantDocs.map(doc => doc.content).join('\n\n');

// 4. Gửi context + question đến AI
const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
const answer = await callAI(prompt);

// 5. Trả về answer + sources
return {
  answer: answer,
  sources: relevantDocs.map(doc => doc.filename)
};
```

## Environment Variables

Để set environment variables cho Functions:

```bash
# Sử dụng Secret Manager (khuyến nghị)
firebase functions:secrets:set GEMINI_API_KEY

# Hoặc sử dụng config (deprecated nhưng vẫn hoạt động)
firebase functions:config:set gemini.api_key="YOUR_KEY"
```

Sau đó trong code:
```javascript
// Với Secret Manager
const apiKey = process.env.GEMINI_API_KEY;

// Với config (deprecated)
const functions = require('firebase-functions');
const apiKey = functions.config().gemini.api_key;
```

## Deploy

```bash
# Deploy tất cả functions
firebase deploy --only functions

# Deploy function cụ thể
firebase deploy --only functions:chatFunction

# Deploy với environment variables
firebase deploy --only functions --set-secrets GEMINI_API_KEY=gemini-api-key
```

## Test Local

```bash
# Chạy emulator
npm run serve

# Test với curl
curl -X POST http://localhost:5001/thithi-3e545/us-central1/chatFunction \
  -H "Content-Type: application/json" \
  -d '{"question":"Xin chào"}'
```

## Logs

```bash
# Xem logs
firebase functions:log

# Xem logs của function cụ thể
firebase functions:log --only chatFunction
```

## Lưu ý

- Functions sử dụng Node.js 20
- CORS đã được enable
- Max instances: 10 (có thể điều chỉnh)
- Đảm bảo set đúng environment variables trước khi deploy



