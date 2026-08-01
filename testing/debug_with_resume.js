#!/usr/bin/env node
// Debug: see raw model output for the "with resume" case
const fs = require("fs");
const path = require("path");

const SERVER = "http://127.0.0.1:8080";
const GRAMMAR = fs.readFileSync(path.join(__dirname, "..", "grammars", "generate_question.gbnf"), "utf8");

const RESUME = "3 years as a backend developer, built REST APIs in Node.js and Python, experienced with PostgreSQL, Redis, Docker. Led migration from monolith to microservices.";

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

const exemplarLines = EXEMPLARS.map((ex, i) =>
  `Example ${i + 1}:\n  question: "${ex.question}"\n  topic: "${ex.topic}"\n  whatAGoodAnswerCovers: ${JSON.stringify(ex.whatAGoodAnswerCovers)}\n  commonMistakes: ${JSON.stringify(ex.commonMistakes)}`
).join("\n\n");

const prompt = [
  "You are an experienced interviewer generating mock interview questions for a candidate.",
  "",
  "Role: Backend Developer",
  "Level: easy",
  "Round: Technical",
  "Generate exactly 5 question(s) for this round.",
  "",
  `Candidate context (resume or job description):\n${RESUME}`,
  "",
  `Topic taxonomy for this role/level (stay on-domain): ${TAXONOMY}`,
  "",
  "No topics are excluded.",
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
  exemplarLines,
  "",
  "Write out every field in full. Never use \"...\" or any other placeholder text.",
  "",
  "Respond with a JSON array matching the schema exactly, no extra text."
].join("\n");

(async () => {
  for (let i = 0; i < 3; i++) {
    console.log(`\n=== RUN ${i+1} ===`);
    const res = await fetch(`${SERVER}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, grammar: GRAMMAR, temperature: 0.5, n_predict: 4000, stream: false })
    });
    const data = await res.json();
    console.log("Raw content length:", data.content.length);
    console.log("Raw content (first 500 chars):", data.content.substring(0, 500));
    try {
      const parsed = JSON.parse(data.content);
      console.log("Parsed array length:", parsed.length);
      parsed.forEach((q, j) => console.log(`  Q${j+1}: ${q.question?.substring(0, 80)}...`));
    } catch (e) {
      console.log("Parse error:", e.message);
    }
  }
})();
