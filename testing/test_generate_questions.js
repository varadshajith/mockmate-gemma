#!/usr/bin/env node
// Phase 1 test harness — runs outside the browser, hitting llama-server directly.
// Replicates LLM.generateQuestions() + testGenerateQuestions() from src/llm.js.
const fs = require("fs");
const path = require("path");

const SERVER = "http://192.168.137.123:8080";
const GRAMMAR_PATH = path.join(__dirname, "..", "grammars", "generate_question.gbnf");

function buildPrompt(req) {
  const roundLabel = req.round === "behavioral" ? "Behavioral (STAR)" : "Technical";
  const contextLine = req.candidateContext
    ? `Candidate context (resume or job description):\n${req.candidateContext}`
    : `No candidate context provided. Generate questions grounded in the topic taxonomy below.`;
  const excludeLine = (req.excludeTopics && req.excludeTopics.length)
    ? `Topics already used recently (do NOT repeat these): ${req.excludeTopics.join(", ")}`
    : "No topics are excluded.";
  const exemplarLines = (req.exemplars || []).map((ex, i) =>
    `Example ${i + 1}:\n  question: "${ex.question}"\n  topic: "${ex.topic}"\n  whatAGoodAnswerCovers: ${JSON.stringify(ex.whatAGoodAnswerCovers)}\n  commonMistakes: ${JSON.stringify(ex.commonMistakes)}`
  ).join("\n\n");

  return [
    "You are an experienced interviewer generating mock interview questions for a candidate.",
    "",
    `Role: ${req.role}`,
    `Level: ${req.level}`,
    `Round: ${roundLabel}`,
    `Generate exactly ${req.count} question(s) for this round.`,
    "",
    contextLine,
    "",
    `Topic taxonomy for this role/level (stay on-domain): ${req.topicTaxonomy || "(not provided)"}`,
    "",
    excludeLine,
    "",
    "Each question must be:",
    "- A real interview question, 8-60 words, no placeholders like [topic] or 'your project'",
    "- On a distinct topic from the taxonomy (or from the candidate context if provided)",
    "- Calibrated to the level: easy = fundamentals, medium = applied/intermediate, advanced = system-level/senior",
    "",
    "For each question, provide:",
    '- "question": the question text',
    '- "topic": a short topic label (2-4 words) for the exclusion list',
    '- "whatAGoodAnswerCovers": 3-5 things a strong answer should address',
    '- "commonMistakes": 2-3 common mistakes weak answers make',
    "",
    "Few-shot examples (match the shape and difficulty calibration):",
    exemplarLines || "(no examples provided)",
    "",
    "Write out every field in full. Never use \"...\" or any other placeholder text.",
    "",
    "Respond with a JSON array matching the schema exactly, no extra text."
  ].join("\n");
}

function isMalformed(q) {
  if (!q || typeof q !== "object") return "not an object";
  const text = (q.question || "").trim();
  if (text.length === 0) return "empty question text";
  const wc = text.split(/\s+/).length;
  if (wc < 8) return `too short (${wc} words)`;
  if (wc > 60) return `too long (${wc} words)`;
  if (/\[topic\]|\[your\s+project\]|your\s+project|\.\.\./i.test(text)) return `placeholder`;
  if (!Array.isArray(q.whatAGoodAnswerCovers) || q.whatAGoodAnswerCovers.length === 0) return "empty whatAGoodAnswerCovers";
  return null;
}

async function generateQuestions(req) {
  const grammar = fs.readFileSync(GRAMMAR_PATH, "utf8");
  const prompt = buildPrompt(req);
  const MAX_ATTEMPTS = 2;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${SERVER}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, grammar, temperature: 0.5, n_predict: 4000, stream: false })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const parsed = JSON.parse(data.content);

      if (!Array.isArray(parsed)) throw new Error("not an array");

      console.log(`  attempt ${attempt + 1}: got ${parsed.length} questions`);
      parsed.forEach((q, i) => {
        const m = isMalformed(q);
        console.log(`    Q${i+1}: ${m ? "MALFORMED: " + m : "OK"} question="${(q?.question || "").substring(0, 80)}..."`);
      });

      const malformed = parsed.map(q => isMalformed(q)).filter(Boolean);
      if (malformed.length === 0) return parsed;

      console.warn(`  attempt ${attempt + 1}: ${malformed.length} malformed:`, malformed);
      if (attempt === MAX_ATTEMPTS - 1) return parsed.map(q => isMalformed(q) ? null : q);
    } catch (err) {
      console.warn(`  attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt === MAX_ATTEMPTS - 1) return null;
    }
  }
  return null;
}

(async () => {
  const WITH_RESUME = "3 years as a backend developer, built REST APIs in Node.js and Python, experienced with PostgreSQL, Redis, Docker. Led migration from monolith to microservices.";
  const EXEMPLARS = [
    {
      question: "What's the difference between SQL and NoSQL databases?",
      topic: "SQL vs NoSQL",
      whatAGoodAnswerCovers: ["Schema flexibility tradeoffs", "When to choose each", "Real-world example of using one"],
      commonMistakes: ["Saying NoSQL is just 'not structured'", "No example from real use"]
    },
    {
      question: "What does an index do in a database, and why can't you just index everything?",
      topic: "Database indexing",
      whatAGoodAnswerCovers: ["What an index is under the hood", "Write-time cost of indexes", "Real example of over-indexing"],
      commonMistakes: ["Only saying 'it makes reads faster'", "No mention of write penalty"]
    }
  ];
  const TAXONOMY = "HTTP methods, REST, JSON, status codes, middleware, JWT/OAuth, SQL joins, indexing, microservices, queues, CQRS, rate limiting";

  console.log("=== WITH RESUME (5 questions) ===");
  const t1 = Date.now();
  const withResume = await generateQuestions({
    role: "Backend Developer", level: "easy", round: "technical",
    candidateContext: WITH_RESUME, excludeTopics: [], exemplars: EXEMPLARS,
    topicTaxonomy: TAXONOMY, count: 5
  });
  const lat1 = Date.now() - t1;
  if (withResume) withResume.forEach((q, i) => console.log(`\n--- Q${i+1} ---\n${JSON.stringify(q, null, 2)}`));
  else console.log("FAILED");

  console.log("\n=== WITHOUT RESUME (topic-seeded, 5 questions) ===");
  const t2 = Date.now();
  const noResume = await generateQuestions({
    role: "Backend Developer", level: "easy", round: "technical",
    candidateContext: null, excludeTopics: [], exemplars: EXEMPLARS,
    topicTaxonomy: TAXONOMY, count: 5
  });
  const lat2 = Date.now() - t2;
  if (noResume) noResume.forEach((q, i) => console.log(`\n--- Q${i+1} ---\n${JSON.stringify(q, null, 2)}`));
  else console.log("FAILED");

  console.log("\n=== LATENCY ===");
  console.log(`With resume:    ${lat1}ms`);
  console.log(`Without resume: ${lat2}ms`);

  console.log("\n=== TOPIC OVERLAP CHECK ===");
  if (withResume && noResume) {
    const topics1 = withResume.map(q => q?.topic).filter(Boolean);
    const topics2 = noResume.map(q => q?.topic).filter(Boolean);
    const overlap = topics1.filter(t => topics2.includes(t));
    console.log(`With-resume topics:    ${JSON.stringify(topics1)}`);
    console.log(`Without-resume topics: ${JSON.stringify(topics2)}`);
    console.log(`Overlap: ${overlap.length ? overlap : "NONE (good)"}`);
  }
})();
