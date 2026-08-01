"use strict";

const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const vm = require("node:vm");

const values = new Map();
const context = {
  console,
  fetch,
  AbortController,
  setTimeout,
  clearTimeout,
  performance,
  localStorage: {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("src/memory.js", "utf8"), context);

async function measure(entryCount) {
  const { InterviewMemory } = context;
  const embedding = await InterviewMemory.embedText("redis caching tradeoffs");
  const entries = Array.from({ length: entryCount }, (_, index) => ({
    id: `benchmark-${index}`,
    timestamp: index,
    roleId: "backend",
    round: "technical",
    topic: "redis caching",
    question: "Explain cache invalidation tradeoffs.",
    score: 42,
    weakness: "Explain consistency and invalidation tradeoffs.",
    embedding
  }));
  context.localStorage.setItem(InterviewMemory.STORAGE_KEY, JSON.stringify(entries));

  const started = performance.now();
  const matches = await InterviewMemory.retrieve("redis caching tradeoffs");
  const elapsedMs = performance.now() - started;
  console.log(JSON.stringify({ entryCount, elapsedMs, matchCount: matches.length, dimensions: embedding.length }));
}

Promise.resolve()
  .then(() => measure(50))
  .then(() => measure(200))
  .catch((error) => { console.error(error); process.exitCode = 1; });
