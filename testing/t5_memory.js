/**
 * testing/t5_memory.js — Stop Point A verification
 *
 * Tests call the real code paths:
 *   - Gates 2 and 5 call IM.storeWeakAnswer() directly.
 *   - Gates 3, 4 and 6 call MemoryPersist.maybeStoreWeakAnswer() — the single
 *     source of truth for the gate logic. Any future edit to that function is
 *     automatically tested here.
 *   - Test 7 measures an unrelated-topic baseline to validate the 0.45 threshold.
 *
 * Run:
 *   node testing/t5_memory.js
 *
 * Requires: embedding server at 127.0.0.1:8081 (bge-small, --pooling mean)
 */

const STORAGE_KEY = "gemma_v2_memory";

const fs = require("fs");
const path = require("path");

// Minimal localStorage shim for Node
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; }
};

// Minimal crypto shim
const { randomUUID } = require("crypto");
global.crypto = { randomUUID };

// Minimal DOM & browser shims for app.js loading in Node
global.window = global;
global.document = {
  getElementById: () => ({ addEventListener: () => {}, style: {}, innerHTML: "" }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.location = { hash: "" };
global.lucide = { createIcons: () => {} };
global.showToast = () => {};
global.LEVEL_RULES = {};
global.LEVEL_TOPICS = {};
global.APP_STATE = { currentInterview: null, history: [] };

require("../src/memory.js");
const IM = global.InterviewMemory;
require("../src/memory_persist.js");
const MP = global.MemoryPersist;

// Load real app.js to access app.js functions directly (e.g. gradeAnswers)
const appJsCode = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
eval(appJsCode);

const FAKE_SESSION = { roleId: "backend", roundType: "technical" };

function pass(msg) { console.log(`  OK   ${msg}`); }
function fail(msg) { console.error(`  FAIL ${msg}`); process.exitCode = 1; }
function storeSize() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").length; }

// ── Test 1: Retrieve ─────────────────────────────────────────────────────────
async function testRetrieve() {
  console.log("\n=== 1. Retrieve: seed two records, confirm cosine hit >= 0.45 ===");

  const cachingEmb  = await IM.embedText("Redis caching cache invalidation");
  const concurrEmb  = await IM.embedText("concurrency thread safety race condition");

  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    { id: "f1", timestamp: Date.now() - 86400000, roleId: "backend", round: "technical",
      topic: "Redis caching", question: "How does Redis handle cache invalidation?",
      score: 42, weakness: "Did not explain TTL or eviction policies", embedding: cachingEmb },
    { id: "f2", timestamp: Date.now() - 86400000, roleId: "backend", round: "technical",
      topic: "concurrency", question: "What are the risks of shared mutable state?",
      score: 51, weakness: "Did not mention race conditions or locks", embedding: concurrEmb }
  ]));

  const results = await IM.retrieve("Backend Engineer caching databases concurrency", { limit: 3, threshold: 0.45 });

  if (!results.length) { fail("No results above threshold 0.45 — check embedding server"); return; }

  console.log("  Retrieved:", results.map(r => `"${r.topic}" sim=${r.similarity?.toFixed(3)}`));

  const hit = results.find(r => r.topic === "Redis caching");
  if (hit && hit.similarity >= 0.45) {
    pass(`"Redis caching" sim=${hit.similarity.toFixed(3)}`);
  } else {
    fail(`"Redis caching" not above threshold 0.45 — got: ${results.map(r => r.topic).join(", ")}`);
  }
}

// ── Test 2: Persist — valid weak answer ─────────────────────────────────────
async function testPersistValid() {
  console.log("\n=== 2. Persist gate: valid weak answer (score 55) — calls IM.storeWeakAnswer ===");
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  const before = storeSize();

  await IM.storeWeakAnswer({
    id: crypto.randomUUID(), timestamp: Date.now(), roleId: "backend",
    round: "technical", topic: "Redis caching",
    question: "How does Redis handle cache invalidation?",
    score: 55, weakness: "Did not explain TTL or eviction policies"
  });

  const after = storeSize();
  if (after === before + 1) pass(`Record written (${before} → ${after})`);
  else fail(`Expected 1 new record, got ${after - before}`);
}

// ── Test 3: evalError gate (calls real maybeStoreWeakAnswer) ─────────────────
async function testEvalErrorGate() {
  console.log("\n=== 3. evalError gate — calls MemoryPersist.maybeStoreWeakAnswer ===");
  const before = storeSize();

  await MP.maybeStoreWeakAnswer(
    { evalError: true, userAnswer: "some text", score: 0, topic: "Redis caching",
      improvements: ["Missing depth"], question: "Q?", roundType: "technical" },
    FAKE_SESSION
  );

  const after = storeSize();
  if (after === before) pass("Store unchanged — evalError correctly suppressed");
  else fail(`Store grew by ${after - before} — gate is broken`);
}

// ── Test 4: Skipped gate (calls real maybeStoreWeakAnswer) ───────────────────
async function testSkippedGate() {
  console.log("\n=== 4. Skip gate — calls MemoryPersist.maybeStoreWeakAnswer ===");
  const before = storeSize();

  await MP.maybeStoreWeakAnswer(
    { evalError: false, userAnswer: "[Question Skipped]", score: 0,
      topic: "Redis caching", improvements: ["Question skipped."], question: "Q?", roundType: "technical" },
    FAKE_SESSION
  );

  const after = storeSize();
  if (after === before) pass("Store unchanged — skipped answer correctly suppressed");
  else fail(`Store grew by ${after - before} — gate is broken`);
}

// ── Test 5: Score >= 60 gate (calls IM.storeWeakAnswer) ─────────────────────
async function testScoreGate() {
  console.log("\n=== 5. Score >= 60 gate: score=70 — calls IM.storeWeakAnswer ===");
  const before = storeSize();

  const result = await IM.storeWeakAnswer({
    id: crypto.randomUUID(), timestamp: Date.now(), roleId: "backend",
    round: "technical", topic: "Redis caching",
    question: "What is Redis?", score: 70, weakness: "Some weakness"
  });

  const after = storeSize();
  if (result === null && after === before) pass("Score 70 rejected by storeWeakAnswer (returned null)");
  else fail(`Expected null+no write — got result=${JSON.stringify(result)}, grew=${after - before}`);
}

// ── Test 6: Missing topic gate (calls real maybeStoreWeakAnswer) ─────────────
async function testMissingTopicGate() {
  console.log("\n=== 6. Missing topic gate — calls MemoryPersist.maybeStoreWeakAnswer ===");
  const before = storeSize();

  await MP.maybeStoreWeakAnswer(
    { evalError: false, userAnswer: "some answer", score: 40, topic: "",
      improvements: ["Missing depth"], question: "Q?", roundType: "technical" },
    FAKE_SESSION
  );

  const after = storeSize();
  if (after === before) pass("Store unchanged — empty topic correctly suppressed");
  else fail(`Store grew by ${after - before} — gate is broken`);
}

// ── Test 7: Unrelated-topic baseline ────────────────────────────────────────
async function testUnrelatedBaseline() {
  console.log("\n=== 7. Threshold baseline: unrelated topic (cooking) vs caching query ===");

  // Seed a "cooking" record
  const cookingEmb = await IM.embedText("baking bread sourdough fermentation yeast");
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    { id: "f3", timestamp: Date.now(), roleId: "backend", round: "behavioral",
      topic: "sourdough bread", question: "How do you bake bread?",
      score: 30, weakness: "Wrong field entirely", embedding: cookingEmb }
  ]));

  const results = await IM.retrieve("Backend Engineer caching databases concurrency", { limit: 3, threshold: 0.45 });
  const cookingHit = results.find(r => r.topic === "sourdough bread");

  const rawResults = await IM.retrieve("Backend Engineer caching databases concurrency", { limit: 3, threshold: 0.0 });
  const cookingRaw = rawResults.find(r => r.topic === "sourdough bread");
  const cookingSim = cookingRaw?.similarity ?? null;

  console.log(`  Cooking sim vs caching query: ${cookingSim?.toFixed(3) ?? "n/a"}`);

  if (cookingHit) {
    fail(`Unrelated topic "sourdough bread" passed 0.45 threshold (sim=${cookingSim?.toFixed(3)}) — threshold too low`);
  } else {
    pass(`Unrelated topic correctly filtered out (sim=${cookingSim?.toFixed(3)}, threshold=0.45)`);
  }
}

// ── Test 8: Same-role adjacent topic similarity & RoleId filter ────────────
async function testRoleIdFilter() {
  console.log("\n=== 8. Adjacent topic similarity & roleId filter ===");

  const flexEmb = await IM.embedText("CSS flexbox layout centering alignment");
  const backendQuery = "Backend Engineer caching databases concurrency";
  const queryEmb = await IM.embedText(backendQuery);
  const rawSim = IM.cosineSimilarity(queryEmb, flexEmb);
  console.log(`  Raw similarity (CSS flexbox vs Backend query): sim=${rawSim.toFixed(3)}`);

  // Seed record as backend role to test threshold alone
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    { id: "f-be", timestamp: Date.now(), roleId: "backend", round: "technical",
      topic: "CSS flexbox layout", question: "How does flexbox centering work?",
      score: 40, weakness: "Confused justify-content and align-items", embedding: flexEmb }
  ]));

  const rawResults = await IM.retrieve(backendQuery, { limit: 3, threshold: 0.45 });
  if (rawResults.length === 0) {
    pass(`Cross-domain topic "CSS flexbox" naturally filtered by threshold 0.45 (sim=${rawSim.toFixed(3)} < 0.45)`);
  } else {
    fail(`Cross-domain topic passed threshold 0.45 (sim=${rawSim.toFixed(3)})`);
  }

  // Seed record as frontend role to test roleId filter isolation
  localStorage.setItem(STORAGE_KEY, JSON.stringify([
    { id: "f-fe", timestamp: Date.now(), roleId: "frontend", round: "technical",
      topic: "CSS flexbox layout", question: "How does flexbox centering work?",
      score: 40, weakness: "Confused justify-content and align-items", embedding: flexEmb }
  ]));

  const backendResults = await IM.retrieve("CSS flexbox layout centering alignment", { roleId: "backend", limit: 3, threshold: 0.45 });
  const frontendResults = await IM.retrieve("CSS flexbox layout centering alignment", { roleId: "frontend", limit: 3, threshold: 0.45 });

  if (backendResults.length === 0 && frontendResults.length === 1 && frontendResults[0].roleId === "frontend") {
    pass("roleId filter correctly isolated frontend weakness from backend role query");
  } else {
    fail(`roleId filter failed: backend query got ${backendResults.length} hits, frontend query got ${frontendResults.length} hits`);
  }
}

// ── Test 9: Real app.js gradeAnswers() -> maybeStoreWeakAnswer ──────────────
async function testEndToEndGradingFlow() {
  console.log("\n=== 9. Real app.js gradeAnswers() -> maybeStoreWeakAnswer ===");
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));

  // Raw answers array as produced by saveAnswer()
  const rawAnswers = [
    {
      question: "How does Redis handle cache invalidation?",
      topic: "Redis caching",
      userAnswer: "It invalidates when memory is full.",
      modelAnswer: "Redis uses TTL and eviction policies like LRU.",
      whatAGoodAnswerCovers: ["TTL", "Eviction policies"],
      graded: {
        score: 45,
        strengths: ["Basic understanding"],
        improvements: ["Did not mention TTL or eviction policies"],
        gradedFrom: "text"
      }
    }
  ];

  // Call the REAL gradeAnswers() function loaded directly from app.js!
  const out = await gradeAnswers(rawAnswers, "technical");

  // Confirm topic is preserved in real gradeAnswers() output
  if (!out || !out[0] || !out[0].topic) {
    fail("REAL app.js gradeAnswers() output is missing topic field!");
    return;
  }
  pass(`REAL app.js gradeAnswers() output preserved topic: "${out[0].topic}"`);

  // Pass real gradeAnswers() output into MemoryPersist.maybeStoreWeakAnswer()
  await MP.maybeStoreWeakAnswer(out[0], FAKE_SESSION);

  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (stored.length === 1 && stored[0].topic === "Redis caching" && stored[0].score === 45) {
    pass(`Graded answer from app.js landed in gemma_v2_memory (topic="${stored[0].topic}", score=${stored[0].score})`);
  } else {
    fail(`End-to-end persistence failed: stored records count=${stored.length}`);
  }
}

// ── Run all ───────────────────────────────────────────────────────────────────
(async () => {
  console.log("T5 Stop Point A & B — memory integration gates (v2: real function calls)");
  try {
    await testRetrieve();
    await testPersistValid();
    await testEvalErrorGate();
    await testSkippedGate();
    await testScoreGate();
    await testMissingTopicGate();
    await testUnrelatedBaseline();
    await testRoleIdFilter();
    await testEndToEndGradingFlow();
  } catch (e) {
    console.error("\nFATAL:", e.message);
    process.exitCode = 1;
  }
  console.log("\n──────────────────────────────────────────────");
  if (process.exitCode === 1) {
    console.error("RESULT: FAIL — one or more gates broken");
  } else {
    console.log("RESULT: PASS — all gates hold");
  }
})();
