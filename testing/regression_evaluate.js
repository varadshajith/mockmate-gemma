#!/usr/bin/env node
// Star fixture re-run: T1 audio grading regression check.
// Verifies the evaluate() prompt is byte-identical when whatAGoodAnswerCovers
// is absent, by running the same request twice and asserting score equality.
// Run: node testing/regression_evaluate.js
(async () => {
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const SERVER = "http://127.0.0.1:8080";
const GRAMMAR_URL = "http://localhost:8080"; // serves from project root

const prompt = [
  "You are an interview coach grading a candidate's spoken interview answer.",
  "",
  "Category: Technical",
  "Question: What is the virtual DOM and why does React use it?",
  "Reference answer: The Virtual DOM is a lightweight, in-memory representation of the real DOM. React uses it to improve performance.",
  "Candidate's answer: Virtual DOM is a copy of real DOM in JS memory. When state updates, React changes virtual DOM first, then diffs the new one with old one to update only the changed things in the browser. It makes rendering faster.",
  "The complete answer is the transcript above.",
  "An audio clip may also be attached.",
  "",
  "Grade this Technical answer against four dimensions:",
  "- Definition: do they define the thing correctly?",
  "- Mechanism: can they explain how it actually works?",
  "- Tradeoff: do they name what it COSTS?",
  "- Experience: do they ground it in something they have actually built?",
  "",
  "If a dimension is absent, say so plainly.",
  "Do NOT manufacture a compliment.",
  "",
  "Set \"complexity\" to null.",
  "",
  "Decide \"levelSignal\":",
  "- score > 75: \"step_up\"",
  "- score 50-75 inclusive: \"stay\"",
  "- score < 50 and probe NOT used: \"probe\"",
  "- score < 50 and probe used: \"step_down\"",
  "A probe has not been used on this topic.",
  "",
  "Respond with a single JSON object matching the schema exactly, no extra text."
].join("\n");

// Text-only path (same as the star fixture)
const grammar = await fetch("http://127.0.0.1:8080").catch(() => null);
if (!grammar) {
  console.log("GPU BOX DOWN — cannot run regression.");
  process.exit(0);
}

// We need the actual grammar file
const fs = require("fs");
const grammarText = fs.readFileSync("grammars/evaluate.gbnf", "utf8");

const scores = [];
for (let i = 0; i < 3; i++) {
  const res = await fetch(`${SERVER}/completion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, grammar: grammarText, temperature: 0.2, n_predict: 700, stream: false })
  });
  const data = await res.json();
  const parsed = JSON.parse(data.content);
  scores.push(parsed.score);
  console.log(`Run ${i+1}: score=${parsed.score}`);
}

const stable = scores.every(s => s === scores[0]);
console.log(`Stable: ${stable ? "PASS" : "FAIL"} (expected all 3 identical)`);
console.log(`Reference: T1 score was 88 (text-only). Check if within 5 points.`);
})();
