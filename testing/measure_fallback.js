#!/usr/bin/env node
// Fallback rate measurement: 20 runs × 5 questions = 100 slots.
// Counts how many slots fall back to bank questions (null in the generated
// array) vs how many succeed with real generated questions.
// Run: node testing/measure_fallback.js
(async () => {
const fs = require("fs");
const SERVER = "http://127.0.0.1:8080";

const RESUME = "Backend engineer, 4 years. Built a payment retry system at Razorpay — RabbitMQ dead-letter queues with exponential backoff, reduced dropped transactions by 40%. Wrote the PostgreSQL partitioning migration that moved our audit_log table (900M rows) from a single table to monthly partitions without downtime. At my current role I maintain 12 Node.js microservices behind Kong API gateway. Worked on a RAG pipeline for internal docs search using pgvector.";

const prompt = [
  `Write 5 interview questions about this candidate's experience. Name their specific projects or technologies.`,
  `Role: Backend Developer, easy, Technical. Topics: HTTP methods, REST, JSON, status codes, middleware, JWT/OAuth, SQL joins, indexing, microservices, queues, CQRS, rate limiting.`,
  "",
  RESUME,
  "",
  `Output a JSON array. Each object: {"question": ..., "topic": ..., "whatAGoodAnswerCovers": [...], "commonMistakes": [...]}`
].join("\n");

const RUNS = 20;
const SLOTS_PER_RUN = 5;
let totalSlots = 0;
let fallbackSlots = 0;
let parseFailures = 0;

function stripFences(content) {
  let s = (content || "").trim();
  const fm = s.match(/^[\s\n]*```(?:json)?\s*\n([\s\S]*?)\n?\s*```\s*$/);
  if (fm) s = fm[1].trim();
  return s;
}

function repairJSON(content) {
  let s = stripFences(content);
  let depth = 0, lastClose = -1;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === "}") { depth++; if (depth === 1) lastClose = i; }
    if (s[i] === "{") depth--;
  }
  if (lastClose >= 0) s = s.substring(0, lastClose + 1) + "]";
  const end = s.lastIndexOf("]");
  if (end >= 0) s = s.substring(0, end + 1);
  return s;
}

for (let run = 0; run < RUNS; run++) {
  try {
    const res = await fetch(`${SERVER}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, temperature: 0.7, n_predict: 8000, stream: false })
    });
    const d = await res.json();
    let parsed;
    try { parsed = JSON.parse(d.content); }
    catch (e1) {
      try { parsed = JSON.parse(repairJSON(d.content)); }
      catch (e2) { parseFailures++; continue; }
    }
    if (!Array.isArray(parsed)) { parseFailures++; continue; }
    const valid = parsed.filter(q => {
      if (!q || !q.question) return false;
      const wc = q.question.trim().split(/\s+/).length;
      return wc >= 8 && wc <= 60 && !/\.\.\./.test(q.question) && Array.isArray(q.whatAGoodAnswerCovers) && q.whatAGoodAnswerCovers.length > 0;
    });
    const fallback = parsed.length - valid.length;
    totalSlots += parsed.length;
    fallbackSlots += fallback;
    console.log(`Run ${run+1}: ${valid.length}/${parsed.length} valid, ${fallback} fallback`);
  } catch (e) {
    console.log(`Run ${run+1}: error — ${e.message.substring(0,60)}`);
    parseFailures++;
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Runs: ${RUNS}, parse failures: ${parseFailures}`);
console.log(`Total slots attempted: ${totalSlots}`);
console.log(`Fallback slots: ${fallbackSlots} (${(fallbackSlots / Math.max(1,totalSlots) * 100).toFixed(1)}%)`);
console.log(`Threshold: over 10% fallback means repetition risk.`);
})();
