#!/usr/bin/env node
// T2 GPU box validation — three measurements, one pass.
// Run: node testing/t2_validate.js
//
// 1. Regression: star fixture with/without whatAGoodAnswerCovers
//    Baseline: 88 text-only, 90 audio+text. Pass: within ±5.
// 2. Fallback rate: 20 runs × 5 slots. Pass: under 10% fallback.
// 3. Resume grounding: avg across 20 runs. Pass: ≥60% grounded.
(async () => {
const fs = require("fs");
const LLM = require("../src/llm.js");
const SERVER = "http://127.0.0.1:8080";

// ── helpers ──
const STAR_Q = "What is the virtual DOM and why does React use it?";
const STAR_ANS = "Virtual DOM is a copy of real DOM in JS memory. When state updates, React changes virtual DOM first, then diffs the new one with old one to update only the changed things in the browser. It makes rendering faster.";
const STAR_REF = "The Virtual DOM is a lightweight, in-memory representation of the real DOM. React uses it to improve performance.";
const STAR_COVERS = [
  "What the virtual DOM actually is (in-memory JS tree)",
  "How diffing works — why it avoids touching real DOM",
  "That the real DOM is expensive, so batching updates matters"
];

async function evaluateOnce({ question, answer, modelAnswer, covers }) {
  // Mock the request object LLM.evaluate expects
  return await LLM.evaluate({
    category: "Technical",
    question,
    userAnswer: answer,
    modelAnswer,
    whatAGoodAnswerCovers: covers || [],
    audioB64: null,
    isTechnical: true
  });
}

// ── 1. REGRESSION ──
console.log("=== 1. REGRESSION: STAR FIXTURE ===\n");

const refScores = [];
for (let i = 0; i < 3; i++) {
  const r = await evaluateOnce({ question: STAR_Q, answer: STAR_ANS, modelAnswer: STAR_REF });
  refScores.push(r.score);
  console.log(`  reference-answer mode run ${i+1}: score=${r.score}`);
}

const coverScores = [];
for (let i = 0; i < 3; i++) {
  const r = await evaluateOnce({ question: STAR_Q, answer: STAR_ANS, covers: STAR_COVERS });
  coverScores.push(r.score);
  console.log(`  checklist-anchor mode  run ${i+1}: score=${r.score}`);
}

const refAvg = refScores.reduce((a,b)=>a+b,0) / refScores.length;
const coverAvg = coverScores.reduce((a,b)=>a+b,0) / coverScores.length;
console.log(`\n  Reference baseline: ${refAvg.toFixed(0)}  (baseline 88)`);
console.log(`  Checklist anchor:   ${coverAvg.toFixed(0)}`);
console.log(`  Delta: ${(coverAvg - refAvg).toFixed(0)} points`);
console.log(`  Pass: ${Math.abs(coverAvg - 88) <= 5 && Math.abs(refAvg - 88) <= 5 ? "YES" : "NO — scale shifted"}`);

// ── 2. FALLBACK RATE ──
console.log("\n=== 2. FALLBACK RATE: 20 RUNS x 5 ===\n");

const RESUME = "Backend engineer, 4 years. Built a payment retry system at Razorpay — RabbitMQ dead-letter queues with exponential backoff, reduced dropped transactions by 40%. Wrote the PostgreSQL partitioning migration that moved our audit_log table (900M rows) from a single table to monthly partitions without downtime. At my current role I maintain 12 Node.js microservices behind Kong API gateway. Worked on a RAG pipeline for internal docs search using pgvector.";

const GEN_PROMPT = [
  `Write 5 interview questions about this candidate's experience. Name their specific projects or technologies.`,
  `Role: Backend Developer, easy, Technical. Topics: HTTP methods, REST, JSON, status codes, middleware, JWT/OAuth, SQL joins, indexing, microservices, queues, CQRS, rate limiting.`,
  "",
  RESUME,
  "",
  `Output a JSON array. Each object: {"question": ..., "topic": ..., "whatAGoodAnswerCovers": [...], "commonMistakes": [...]}`
].join("\n");

function stripFences(c) {
  let s = (c||"").trim();
  const fm = s.match(/^[\s\n]*```(?:json)?\s*\n([\s\S]*?)\n?\s*```\s*$/);
  return fm ? fm[1].trim() : s;
}
function repairJSON(c) {
  let s = stripFences(c);
  let depth=0, lc=-1;
  for (let i=s.length-1;i>=0;i--) { if(s[i]==="}") { depth++; if(depth===1) lc=i; } if(s[i]==="{") depth--; }
  if(lc>=0) s=s.substring(0,lc+1)+"]";
  const end=s.lastIndexOf("]");
  return end>=0 ? s.substring(0,end+1) : s;
}

let totalSlots=0, fallbackSlots=0, parseFailures=0;
let groundingScores = [];

for (let run=0; run<20; run++) {
  try {
    const res = await fetch(`${SERVER}/completion`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ prompt:GEN_PROMPT, temperature:0.7, n_predict:8000, stream:false })
    });
    const d = await res.json();
    let parsed;
    try { parsed=JSON.parse(d.content); }
    catch(e1) { try { parsed=JSON.parse(repairJSON(d.content)); } catch(e2){ parseFailures++; continue; } }
    if (!Array.isArray(parsed)) { parseFailures++; continue; }

    const valid = parsed.filter(q => {
      if(!q||!q.question) return false;
      const wc = q.question.trim().split(/\s+/).length;
      return wc>=8 && wc<=60 && !/\.\.\./.test(q.question||"") && Array.isArray(q.whatAGoodAnswerCovers) && q.whatAGoodAnswerCovers.length>0;
    });
    const fb = parsed.length - valid.length;
    totalSlots += parsed.length;
    fallbackSlots += fb;

    // grounding check
    const contextNouns = new Set();
    ["postgresql","rabbitmq","redis","docker","kubernetes","kong","pgvector","microservices","razorpay","rag","mongodb","kafka"].forEach(t=>{
      if(RESUME.toLowerCase().includes(t)) contextNouns.add(t);
    });
    const grounded = valid.filter(q=>{
      const ql=(q.question||"").toLowerCase();
      return [...contextNouns].some(n=>ql.includes(n.toLowerCase()));
    }).length;
    groundingScores.push(valid.length>0 ? grounded/valid.length : 0);

    console.log(`  run ${run+1}: ${valid.length}/${parsed.length} valid, ${fb} fallback, ${(grounded*100/valid.length).toFixed(0)}% grounded`);
  } catch(e) {
    console.log(`  run ${run+1}: error — ${e.message.substring(0,50)}`);
    parseFailures++;
  }
}

console.log(`\n  Parse failures: ${parseFailures}/20`);
const fbPct = totalSlots>0 ? (fallbackSlots/totalSlots*100).toFixed(1) : 0;
console.log(`  Fallback: ${fallbackSlots}/${totalSlots} slots (${fbPct}%)`);
console.log(`  Pass: ${(totalSlots>0 && fallbackSlots/totalSlots <= 0.1) && parseFailures<=1 ? "YES" : "NO"}`);

// ── 3. GROUNDING ──
const avgGrounding = groundingScores.length ? (groundingScores.reduce((a,b)=>a+b,0)/groundingScores.length*100).toFixed(0) : 0;
console.log(`\n=== 3. RESUME GROUNDING ===`);
console.log(`  Average grounding across ${groundingScores.length} runs: ${avgGrounding}%`);
console.log(`  Pass: ${avgGrounding>=60 ? "YES" : "NO — under 60% threshold"}`);

console.log("\n=== ALL DONE ===");
})();
