"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadMemory(fetchImpl) {
  const context = {
    console,
    localStorage: makeStorage(),
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
    Math
  };
  context.window = context;
  vm.createContext(context);
  const source = fs.existsSync("src/memory.js") ? fs.readFileSync("src/memory.js", "utf8") : "";
  vm.runInContext(source, context);
  return context;
}

async function run() {
  const native = loadMemory(async () => ({ ok: true, json: async () => ({ embedding: [1, 0] }) }));
  assert.deepEqual(Array.from(native.InterviewMemory.parseEmbeddingResponse({ embedding: [1, 0] })), [1, 0]);
  assert.deepEqual(
    Array.from(native.InterviewMemory.parseEmbeddingResponse({ data: [{ embedding: [0, 1] }] })),
    [0, 1]
  );

  const { InterviewMemory, localStorage } = loadMemory(async (_url, options) => {
    const body = JSON.parse(options.body);
    const vector = body.content.includes("redis") ? [1, 0] : [0, 1];
    return { ok: true, json: async () => ({ embedding: vector }) };
  });
  for (let i = 0; i < 201; i++) {
    await InterviewMemory.storeWeakAnswer({
      id: `weak-${i}`, timestamp: i, roleId: "backend", round: "technical",
      topic: i < 4 ? "redis caching" : `topic-${i}`,
      question: "Question", score: 42, weakness: "Explain tradeoffs"
    });
  }
  const saved = JSON.parse(localStorage.getItem("gemma_v2_memory"));
  assert.equal(saved.length, 200);
  assert.equal(saved[0].id, "weak-1");

  const matches = await InterviewMemory.retrieve("redis caching", { threshold: 0.45 });
  assert.equal(matches.length, 3);
  assert.equal(matches[0].id, "weak-1");
  assert.ok(matches.every((match) => match.similarity >= 0.45));

  const skipped = await InterviewMemory.storeWeakAnswer({
    id: "not-weak", timestamp: 300, roleId: "backend", round: "technical",
    topic: "redis", question: "Question", score: 60, weakness: "Ignored"
  });
  assert.equal(skipped, null);
  assert.equal(JSON.parse(localStorage.getItem("gemma_v2_memory")).length, 200);
}

run().then(
  () => console.log("memory tests passed"),
  (error) => { console.error(error); process.exitCode = 1; }
);
