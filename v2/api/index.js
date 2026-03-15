const express = require('express');
const groq = require('groq-sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));
app.use(express.static('templates'));

// Groq API
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable not set');
}
const client = new groq({ apiKey: GROQ_API_KEY });

// Rate limiting (in-memory)
const RATE_LIMIT = 5;
const RATE_WINDOW = 3600 * 1000; // 1 hour
const MAX_FILE_SIZE = 500 * 1024; // 500 KB
const requestLog = new Map();

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  if (!requestLog.has(ip)) requestLog.set(ip, []);
  const logs = requestLog.get(ip).filter(t => now - t < RATE_WINDOW);
  if (logs.length >= RATE_LIMIT) return true;
  logs.push(now);
  requestLog.set(ip, logs);
  return false;
}

// File upload
const upload = multer({ dest: 'uploads/', limits: { fileSize: MAX_FILE_SIZE } });

// Extract text from file
async function extractTextFromFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const buffer = fs.readFileSync(file.path);

  if (ext === '.txt') {
    return buffer.toString('utf-8');
  } else if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    throw new Error('Unsupported file type. Use .pdf, .docx, or .txt');
  }
}

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const field = req.body.field;
  if (!req.file) return res.json({ error: 'No file uploaded' });
  try {
    const text = await extractTextFromFile(req.file);
    if (text.trim().length < 50) return res.json({ error: 'Extracted text too short' });
    res.json({ text: text.substring(0, 8000) });
  } catch (err) {
    res.json({ error: err.message });
  } finally {
    fs.unlinkSync(req.file.path); // Clean up
  }
});

app.post('/analyze', async (req, res) => {
  const ip = getClientIP(req);
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Rate limit reached. Try again later.' });

  const { resume, job_desc } = req.body;
  if (!resume || !job_desc) return res.status(400).json({ error: 'Both resume and job description required' });
  if (resume.length < 50) return res.status(400).json({ error: 'Resume too short' });
  if (job_desc.length < 30) return res.status(400).json({ error: 'Job description too short' });

  const resumeTrunc = resume.substring(0, 6000);
  const jobDescTrunc = job_desc.substring(0, 3000);

  const prompt = `You are FutureScore AI — an elite North American career coach and ATS expert in 2026.
You deeply understand emerging tech: Agentic AI, LLMs, quantum computing, green tech, cybersecurity mesh, spatial computing, and the skills economy.

Analyze the resume vs job description below. Be specific, actionable, and honest.

RESUME:
${resumeTrunc}

JOB DESCRIPTION:
${jobDescTrunc}

Respond in EXACTLY this structure (do not deviate):

SCORE: [0-100]

ATS BREAKDOWN:
- Keyword Match: [X/25] — [1 sentence explanation]
- Semantic Relevance: [X/25] — [1 sentence explanation]
- Formatting & Scannability: [X/25] — [1 sentence explanation]
- Recency & Impact: [X/25] — [1 sentence explanation]

STRENGTHS:
- [strength 1]
- [strength 2]
- [strength 3]

MISSING SKILLS:
- [skill 1]
- [skill 2]
- [skill 3]
- [skill 4]

RESUME IMPROVEMENTS:
- [specific improvement 1]
- [specific improvement 2]
- [specific improvement 3]
- [specific improvement 4]

RECOMMENDED COURSES (free, max 3, 2026-relevant):
1. [Course Name] | [Platform] | [URL] | [Duration] | [Why it helps]
2. [Course Name] | [Platform] | [URL] | [Duration] | [Why it helps]
3. [Course Name] | [Platform] | [URL] | [Duration] | [Why it helps]

CAREER ROADMAP:

30 DAYS:
- [action 1]
- [action 2]
- [action 3]

60 DAYS:
- [action 1]
- [action 2]
- [action 3]

90 DAYS:
- [action 1]
- [action 2]
- [action 3]

120 DAYS:
- [action 1]
- [action 2]
- [action 3]

1 YEAR VISION:
- [milestone 1]
- [milestone 2]
- [milestone 3]

SALARY INSIGHT:
[2-3 sentences on realistic salary range for this role in 2026, including negotiation tip]

AI DISRUPTION ALERT:
[2-3 sentences on how AI/automation may affect this role and how to stay relevant]
`;

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      temperature: 0.7,
    });
    const result = response.choices[0].message.content;

    // Parse score
    const scoreMatch = result.match(/SCORE:\s*(\d+)/);
    const score = scoreMatch ? Math.min(parseInt(scoreMatch[1]), 100) : null;

    res.json({ result, score });
  } catch (err) {
    res.status(500).json({ error: `AI analysis failed: ${err.message}` });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));