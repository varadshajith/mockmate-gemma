#!/usr/bin/env node
/**
 * Node bridge for the Kaggle demo notebook.
 *
 * The notebook is Python; the grading path, the threshold rules and the
 * memory retrieval path all live in JavaScript under src/. Two of this
 * project's tests were broken by re-implementing the prompt in the test
 * harness instead of importing it (see README, "Two of our tests were
 * measuring themselves"). So this bridge does not contain a prompt, a
 * rubric, a grammar, a threshold, or a similarity formula. It only:
 *
 *   1. requires the real modules from src/
 *   2. passes through the request it is handed on stdin
 *   3. prints whatever they returned as JSON on stdout
 *
 * If you find yourself adding a prompt string to this file, stop — that is
 * exactly the bug this file exists to avoid.
 *
 * Usage:  node kaggle_bridge.js <grade|level|memory> < request.json
 *
 * This file makes no network calls of its own. Every request it causes is
 * made by src/llm.js or src/memory.js, to 127.0.0.1 only.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { buf += chunk; });
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", reject);
  });
}

/**
 * Rewrite the "temperature" field of every outgoing llama-server request.
 *
 * Used only by cell 9 (the determinism proof), which needs the byte-identical
 * production prompt sent at a different sampling temperature. Building a
 * second copy of the request here would make the comparison meaningless — it
 * would be comparing two prompts, not two temperatures. So the prompt, the
 * grammar and the endpoint all still come from src/llm.js; this wrapper edits
 * exactly one number on the way out and records what it saw.
 */
function installTemperatureOverride(temperature, sink) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (init && typeof init.body === "string") {
      const body = JSON.parse(init.body);
      sink.temperatureBefore = body.temperature;
      if (temperature !== null) body.temperature = temperature;
      sink.temperatureSent = body.temperature;
      sink.endpoint = String(url);
      init = { ...init, body: JSON.stringify(body) };
    }
    return realFetch(url, init);
  };
}

/**
 * Pull deriveLevelSignal() out of src/llm.js as source text and evaluate it.
 *
 * The function is closure-scoped inside the LLM module and is not exported,
 * and this task is not allowed to edit src/. Slicing the real source out of
 * the real file and evaluating it keeps the notebook honest: the bytes the
 * notebook runs are the bytes on disk. Re-typing the thresholds here would
 * be a fabricated demonstration of the thing the cell claims to prove.
 */
function loadDeriveLevelSignal() {
  const source = fs.readFileSync(path.join(REPO_ROOT, "src", "llm.js"), "utf8");
  const start = source.indexOf("function deriveLevelSignal(");
  if (start === -1) throw new Error("deriveLevelSignal() not found in src/llm.js");
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error("could not find end of deriveLevelSignal() in src/llm.js");
  const text = source.slice(start, end);
  // eslint-disable-next-line no-new-func
  const fn = new Function(`return (${text});`)();
  return { fn, text };
}

/** Load src/memory.js in Node. It only assigns to window in a browser. */
function loadInterviewMemory() {
  const source = fs.readFileSync(path.join(REPO_ROOT, "src", "memory.js"), "utf8");
  // eslint-disable-next-line no-new-func
  return new Function(`${source}; return InterviewMemory;`)();
}

async function cmdGrade(req) {
  const LLM = require(path.join(REPO_ROOT, "src", "llm.js"));
  const trace = {};
  const temperature = Number.isFinite(req.temperature) ? req.temperature : null;
  if (temperature !== null) installTemperatureOverride(temperature, trace);
  else installTemperatureOverride(null, trace); // observe only, change nothing

  const started = Date.now();
  const result = await LLM.evaluate(req.request);
  return {
    ok: true,
    latencyMs: Date.now() - started,
    // What the production code asked for vs what actually went on the wire.
    // Equal unless cell 9 deliberately overrode it.
    temperatureFromSrc: trace.temperatureBefore ?? null,
    temperatureSent: trace.temperatureSent ?? null,
    endpoint: trace.endpoint ?? null,
    result
  };
}

async function cmdLevel(req) {
  const { fn, text } = loadDeriveLevelSignal();
  return {
    ok: true,
    source: text,
    sourceFile: "src/llm.js",
    score: req.score,
    probeUsed: req.probeUsed === true,
    levelSignal: fn(req.score, req.probeUsed === true)
  };
}

async function cmdMemory(req) {
  const memory = loadInterviewMemory();
  const started = Date.now();
  const queryVector = await memory.embedText(req.query);
  const rows = [];
  for (const topic of req.topics) {
    const vector = await memory.embedText(topic.text);
    rows.push({
      label: topic.label,
      text: topic.text,
      inDomain: topic.inDomain === true,
      similarity: memory.cosineSimilarity(queryVector, vector)
    });
  }
  return {
    ok: true,
    latencyMs: Date.now() - started,
    query: req.query,
    // The real constant from src/memory.js, not a number typed into the
    // notebook. If the module's default changes, this cell changes with it.
    threshold: memory.DEFAULT_SIMILARITY_THRESHOLD,
    dimensions: queryVector.length,
    rows
  };
}

const COMMANDS = { grade: cmdGrade, level: cmdLevel, memory: cmdMemory };

(async () => {
  const command = process.argv[2];
  const run = COMMANDS[command];
  if (!run) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: `unknown command "${command}" — expected one of ${Object.keys(COMMANDS).join(", ")}`
    }));
    process.exit(2);
  }
  let req;
  try {
    const raw = await readStdin();
    req = raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: `bad stdin JSON — ${err.message}` }));
    process.exit(2);
  }
  try {
    process.stdout.write(JSON.stringify(await run(req)));
  } catch (err) {
    // Rule 1: a failed grading is reported as a failure. It is never replaced
    // with a plausible-looking score.
    process.stdout.write(JSON.stringify({ ok: false, error: err.message, stack: err.stack }));
    process.exit(1);
  }
})();
