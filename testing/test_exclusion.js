#!/usr/bin/env node
// Test: two consecutive sessions on the same role produce non-overlapping topics
// when excludeTopics is passed from session 1 to session 2.
const fs = require("fs");
const path = require("path");

const SERVER = "http://192.168.137.123:8080";
const GRAMMAR = fs.readFileSync(path.join(__dirname, "..", "grammars", "generate_question.gbnf"), "utf8");

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

function buildPrompt(req) {
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
    "", `Role: ${req.role}`, `Level: ${req.level}`, `Round: ${req.round === "behavioral" ? "Behavioral (STAR)" : "Technical"}`,
    `Generate exactly ${req.count} question(s) for this round.`,
    "", contextLine, "", `Topic taxonomy for this role/level (stay on-domain): ${req.topicTaxonomy || "(not provided)"}`,
    "", excludeLine, "",
    "Each question must be:", "- A real interview question, 8-60 words, no placeholders like [topic] or 'your project'",
    "- On a distinct topic from the taxonomy (or from the candidate context if provided)",
    "- Calibrated to the level: easy = fundamentals, medium = applied/intermediate, advanced = system-level/senior",
    "", "For each question, provide:", '- "question": the question text', '- "topic": a short topic label (2-4 words) for the exclusion list',
    '- "whatAGoodAnswerCovers": 3-5 things a strong answer should address', '- "commonMistakes": 2-3 common mistakes weak answers make',
    "", "Few-shot examples (match the shape and difficulty calibration):", exemplarLines || "(no examples provided)",
    "", "Write out every field in full. Never use \"...\" or any other placeholder text.",
    "", "Respond with a JSON array matching the schema exactly, no extra text."
  ].join("\n");
}

async function generate(req) {
  const prompt = buildPrompt(req);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${SERVER}/completion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, grammar: GRAMMAR, temperature: 0.5, n_predict: 4000, stream: false })
      });
      const data = await res.json();
      const parsed = JSON.parse(data.content);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      // Basic quality check
      const valid = parsed.filter(q => {
        const wc = (q.question || "").trim().split(/\s+/).length;
        return wc >= 8 && wc <= 60 && Array.isArray(q.whatAGoodAnswerCovers) && q.whatAGoodAnswerCovers.length > 0;
      });
      if (valid.length === parsed.length) return parsed;
      if (attempt === 1) return parsed;
    } catch (e) {
      if (attempt === 1) return null;
    }
  }
  return null;
}

(async () => {
  console.log("=== SESSION 1 ===");
  const s1 = await generate({
    role: "Backend Developer", level: "easy", round: "technical",
    candidateContext: null, excludeTopics: [], exemplars: EXEMPLARS,
    topicTaxonomy: TAXONOMY, count: 5
  });
  if (!s1) { console.log("FAILED"); return; }
  const topics1 = s1.map(q => q.topic);
  console.log("Session 1 topics:", topics1);

  console.log("\n=== SESSION 2 (with exclusion from session 1) ===");
  const s2 = await generate({
    role: "Backend Developer", level: "easy", round: "technical",
    candidateContext: null, excludeTopics: topics1, exemplars: EXEMPLARS,
    topicTaxonomy: TAXONOMY, count: 5
  });
  if (!s2) { console.log("FAILED"); return; }
  const topics2 = s2.map(q => q.topic);
  console.log("Session 2 topics:", topics2);

  const overlap = topics1.filter(t => topics2.includes(t));
  console.log("\n=== OVERLAP ===");
  console.log(`Session 1: ${JSON.stringify(topics1)}`);
  console.log(`Session 2: ${JSON.stringify(topics2)}`);
  console.log(`Overlap: ${overlap.length ? overlap : "NONE (good)"}`);
})();
