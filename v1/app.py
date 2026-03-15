from flask import Flask, request, render_template, jsonify
import groq
import os
import io
import time
from collections import defaultdict

app = Flask(__name__)

# ── API Client ──────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable not set")

client = groq.Groq(api_key=GROQ_API_KEY)

# ── Rate Limiting (in-memory, resets on restart) ─────────────────────────────
RATE_LIMIT = 5          # requests per window
RATE_WINDOW = 3600      # 1 hour in seconds
MAX_FILE_SIZE = 500_000 # 500 KB

request_log = defaultdict(list)

def get_client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()

def is_rate_limited(ip):
    now = time.time()
    request_log[ip] = [t for t in request_log[ip] if now - t < RATE_WINDOW]
    if len(request_log[ip]) >= RATE_LIMIT:
        return True
    request_log[ip].append(now)
    return False

# ── File Text Extraction ─────────────────────────────────────────────────────
def extract_text_from_file(file):
    filename = file.filename.lower()
    data = file.read(MAX_FILE_SIZE + 1)
    if len(data) > MAX_FILE_SIZE:
        raise ValueError("File too large. Maximum size is 500 KB.")

    if filename.endswith(".txt"):
        return data.decode("utf-8", errors="ignore")

    elif filename.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(data))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            if not text.strip():
                raise ValueError("PDF appears to be scanned/image-based. Please use a text-based PDF.")
            return text
        except ImportError:
            raise ValueError("PDF support unavailable. Please paste your text instead.")

    elif filename.endswith(".docx"):
        try:
            import docx
            doc = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs)
        except ImportError:
            raise ValueError("DOCX support unavailable. Please paste your text instead.")

    else:
        raise ValueError("Unsupported file type. Use .pdf, .docx, or .txt")

# ── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload_file():
    field = request.form.get("field", "resume")
    if field not in ("resume", "job_desc"):
        return jsonify({"error": "Invalid field"}), 400
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400
    try:
        text = extract_text_from_file(file)
        if len(text.strip()) < 50:
            return jsonify({"error": "Extracted text too short. Check your file."}), 400
        return jsonify({"text": text[:8000]})  # cap at 8000 chars
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"File processing failed: {str(e)}"}), 500

@app.route("/analyze", methods=["POST"])
def analyze():
    ip = get_client_ip()
    if is_rate_limited(ip):
        return jsonify({"error": "Rate limit reached. You can make 5 analyses per hour. Please try again later."}), 429

    data = request.json
    resume = (data.get("resume") or "").strip()
    job_desc = (data.get("job_desc") or "").strip()

    if not resume or not job_desc:
        return jsonify({"error": "Both resume and job description are required."}), 400
    if len(resume) < 50:
        return jsonify({"error": "Resume is too short. Please provide more detail."}), 400
    if len(job_desc) < 30:
        return jsonify({"error": "Job description is too short."}), 400

    # Truncate to avoid token abuse
    resume = resume[:6000]
    job_desc = job_desc[:3000]

    prompt = f"""You are FutureScore AI — an elite North American career coach and ATS expert in 2026.
You deeply understand emerging tech: Agentic AI, LLMs, quantum computing, green tech, cybersecurity mesh, spatial computing, and the skills economy.

Analyze the resume vs job description below. Be specific, actionable, and honest.

RESUME:
{resume}

JOB DESCRIPTION:
{job_desc}

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
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2500,
            temperature=0.7
        )
        result = response.choices[0].message.content
    except Exception as e:
        return jsonify({"error": f"AI analysis failed: {str(e)}"}), 500

    # Parse score
    score = None
    for line in result.splitlines():
        if line.upper().startswith("SCORE:"):
            digits = "".join(filter(str.isdigit, line.split(":", 1)[1]))
            if digits:
                score = min(int(digits[:3]), 100)
            break

    return jsonify({"result": result, "score": score})

if __name__ == "__main__":
    app.run(debug=True)
