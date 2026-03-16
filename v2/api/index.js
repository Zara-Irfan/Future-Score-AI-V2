const express = require('express');
const groq = require('groq-sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'templates')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) { throw new Error('GROQ_API_KEY environment variable not set'); }
const client = new groq({ apiKey: GROQ_API_KEY });

const RATE_LIMIT = 5;
const RATE_WINDOW = 3600 * 1000;
const MAX_FILE_SIZE = 500 * 1024;
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

const upload = multer({ dest: '/tmp/', limits: { fileSize: MAX_FILE_SIZE } });

async function extractTextFromFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const buffer = fs.readFileSync(file.path);
  if (ext === '.txt') { return buffer.toString('utf-8'); }
  else if (ext === '.pdf') { const data = await pdfParse(buffer); return data.text; }
  else if (ext === '.docx') { const result = await mammoth.extractRawText({ buffer }); return result.value; }
  else { throw new Error('Unsupported file type. Use .pdf, .docx, or .txt'); }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'templates', 'index.html'));
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ error: 'No file uploaded' });
  try {
    const text = await extractTextFromFile(req.file);
    if (text.trim().length < 50) return res.json({ error: 'Extracted text too short' });
    res.json({ text: text.substring(0, 8000) });
  } catch (err) {
    res.json({ error: err.message });
  } finally {
    fs.unlinkSync(req.file.path);
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
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Analyze resume vs job description.\nRESUME:\n${resumeTrunc}\nJOB DESCRIPTION:\n${jobDescTrunc}` }],
      max_tokens: 2500,
      temperature: 0.7,
    });
    const result = response.choices[0].message.content;
    const scoreMatch = result.match(/SCORE:\s*(\d+)/);
    const score = scoreMatch ? Math.min(parseInt(scoreMatch[1]), 100) : null;
    res.json({ result, score });
  } catch (err) {
    res.status(500).json({ error: `AI analysis failed: ${err.message}` });
  }
});

module.exports = app;
