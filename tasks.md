# Tasks — Offline Mock Interview App

Audited 2026-07-30 against the actual repo (file contents read in full,
`question-bank.js` parsing tested with `node -e`, `git show` used to see
what the last commit actually changed). Status is only marked "done" where
something concrete was verified — a running process, a passing parse, a
file that exists and does what it claims.

Status legend: **done** / **partial** / **not started** / **blocked**

---

## Audio pipeline

| Task | Status | Notes |
|---|---|---|
| Mic capture (`pw-record`, 16kHz mono) | **done** | `sidecar/capture.py`. Spawns `pw-record` with explicit rate/channels/format args so resampling happens at the source. Not run against a real mic in this audit — code-verified only. |
| Chunking at 30s ceiling | **done** | `sidecar/chunker.py`. Implements all three cut reasons (`smart_turn`, `pause`, `force_cut_30s`) with a documented rationale for why force-cutting mid-sentence beats silently losing audio past 30s. |
| Turn detection (Smart Turn) | **done, but version differs from the brief** | `sidecar/turn_detector.py` runs **Smart Turn v3.1** on ONNX CPU-only, not "v2" as the architecture table says. Config comment explains v3.1 was chosen over v3.2 after measuring mid-sentence-cut recordings. Fix the brief/writeup, not the code. |
| Volume gating (too-quiet / pause detection) | **done** | `sidecar/audio_level.py`. dBFS thresholds with a documented 5dB gap and rationale. |
| Transcription call to `llama-server` | **done** | `sidecar/transcribe.py`. Posts to `/v1/chat/completions` with base64 WAV, `enable_thinking: false` (documented fix for a truncation bug where thinking mode silently returns partial transcripts with `finish_reason: "stop"`). |
| WebSocket server (`sidecar/server.py`) | **done** | Binds `127.0.0.1` only, checks `Origin` header against an allowlist, handles `start`/`stop` commands, streams `transcript`/`too_quiet`/`error` messages. |
| Smart Turn model actually downloaded | **not started** | `sidecar/models/` doesn't exist. `fetch_model.py` has not been run in this environment. **Demo-day risk**: must be run (needs network once) before the sidecar can start at all — `TurnDetector.__init__` raises `FileNotFoundError` otherwise. |
| End-to-end test: mic → sidecar → transcript | **not started** | Nothing in the repo proves this has run. No test recordings, no logs, no `testing/` directory despite `config.py` comments referencing one (`"Measured against the recordings in testing/"`). **This is plan.md Step 1 — do this before anything else.** |
| `src/audio.js` wired to the sidecar | **blocked** | `src/audio.js` is 100% mock: `startListening()` replays a canned string word-by-word on a `setInterval`, no `WebSocket` object anywhere in the file, no mic ever opened. This is the single biggest gap between "sidecar exists" and "app works." Blocked on Step 1 (prove the sidecar itself works) being done first. |
| TTS (Piper) | **not started** | Zero references to Piper anywhere in the repo (`grep -rl piper` returns nothing). `speak()` in `src/audio.js` is `console.log` only. This is unbuilt from scratch, not partially wired — the architecture table implies more progress than exists. |

## Grading and state

| Task | Status | Notes |
|---|---|---|
| `src/llm.js` wired to `llama-server /completion` | **done** | Full implementation: `evaluate()`, `followup()`, `recommend()`, each with a GBNF grammar, retry logic for degenerate output, hard failure on any error (no fake scores — matches AGENTS.md rule 1). This directly contradicts the stale README, which still describes this file as mocked. |
| GBNF grammars | **done** | `grammars/evaluate.gbnf`, `followup.gbnf`, `recommend.gbnf` all exist and match what `llm.js` actually sends/parses. |
| STAR / Technical rubrics | **done** | Real rubric text in `llm.js` (`BEHAVIORAL_RUBRIC`, `SYSTEM_DESIGN_RUBRIC`), including the "I vs we" penalty and the tradeoff-as-discriminator framing the question bank's grading philosophy also uses. |
| **State card mechanic (Situation/Task/Action/Result or Definition/Mechanism/Tradeoff/Experience, present/vague/missing per slot)** | **not started** | This is the brief's core mechanic and it does not exist in code. Current `evaluate()` returns one 0-100 score + free-text strengths/improvements + a threshold-derived `levelSignal`. There is no structured per-slot output. **This is the single largest gap between the brief and the repo.** See plan.md Step 3. |
| Follow-up chosen by rule (not improvised by model) | **blocked / contradicts brief** | `LLM.followup()` currently prompts the model to freely write a new clarifying question. The brief explicitly requires code-driven selection from a missing-slot → pre-written-probe rule. The raw material for this already exists (`question-bank.js`'s `probes` object, keyed exactly by slot name) but nothing reads it. Blocked on the state card task above, since the rule needs to know *which* slot is missing. |
| Max-probes-per-question cap | **partial, and possibly the wrong cap** | `app.js` implements a **1-probe-per-round** cap (`roundProbeCount`), not the brief's **2-probes-per-question** cap. These are different limits — reconcile intent before building the rule-based version on top of the wrong counter. |
| Delivery metrics (filler words, pace, pauses) — described not scored | **not started** | No code computing these anywhere. Not blocking for the core mechanic; lower priority per the brief's own framing ("described, never scored"). |

## UI / frontend

| Task | Status | Notes |
|---|---|---|
| SPA shell, router, views (dashboard, setup, interview, results, history, analytics) | **done** | `app.js` (2387 lines) implements all of these. Not yet verified in a live browser during this audit (no code was run) — verify visually once Step 0 below is fixed. |
| **`question-bank.js` loads without a syntax error** | **blocked — currently broken** | Confirmed with `node -e "require('./question-bank.js')"`: `SyntaxError: Unexpected token ':'`. The file is raw JSON with no `const`/`window.` wrapper. Loaded via `<script src="question-bank.js?v=2">` in `index.html`, this throws in the browser and halts the script tag. **The app cannot currently load past this.** This is the highest-priority frontend task — see plan.md Step 0. |
| Role/level/round lookup functions (`getRole`, `getLevelRules`, `getRoundQuestions`) | **not started — deleted by the last commit** | `git show cca1dc2:question-bank.js` (the initial commit) had these functions plus `ROLES`, `LEVEL_RULES`, `LEVEL_TOPICS`, and `window.*` exports. Commit `daf9ec8` ("Added the question-bank.js") deleted all of it and replaced the file with domain-keyed JSON content. `app.js` still calls `getRole()`/`getLevelRules()`/`getRoundQuestions()` throughout — none of these exist anymore. |
| Webcam / face-analysis UI | **present, and must be deleted, not built** | `app.js` has a full `getUserMedia` webcam feature (`activeWebcamStream`, `stopActiveCamera()`, setup toggle, live panel) rendering **hardcoded fake telemetry** — `"Eye Contact"`, `"Posture Index: Stable (98%)"`, `"Aesthetic Noise: Low (0.02)"` are static strings, not computed from anything. This directly violates the brief's explicit "no face or video analysis" decision. Flag as a demo-day risk: if left in, it's a Rule-1-style violation waiting for a judge to ask about it. |
| Auth removal | **already satisfied, nothing to do** | No login/signup route, no password or JWT handling found anywhere in `app.js` — just a `localStorage`-backed profile (`gemma_v2_user`). The brief's "must be removed entirely" instruction is already true; do not spend time on this. |
| Warm-up (unscored) stage | **not started** | No `warmup` reference anywhere in `app.js`, `question-bank.js`, or the sidecar. Only a `quickRound` single-round demo mode exists (`setup.mode === "full" ? [...] : [setup.quickRound]`), which is not the same as an unscored warm-up that captures a speech baseline. |
| Round structure: warm-up → behavioral → technical → design → close | **partial, and structurally mismatched** | `app.js` hardcodes exactly two round types: `behavioral` and `systemDesign`. The brief describes three question types (behavioral / technical / design). The question bank's domain split (backend/frontend/genai/system_design ≈ Technical-shaped, hr ≈ STAR-shaped) doesn't cleanly produce three rounds either. This needs a real design decision (see plan.md Step 6), not just content authoring. |
| Old MCQ / coding round code | **confirmed absent** | No `mcq` or `coding` round logic found in `app.js` beyond one incidental string in mock history data. Matches the brief's "dropped" decision — nothing to remove here. |

## Content (question bank)

| Task | Status | Notes |
|---|---|---|
| 30 questions across 5 domains | **done, content-wise** | Verified by parsing: `backend`, `frontend`, `genai`, `hr`, `system_design`, 6 questions each, 30 total. |
| Reference answers at grade 9/6/3 | **done** | Every question has `reference_answers.score_9/score_6/score_3`, written with a clear quality gradient (verified by reading several — e.g. the Redis question's grade-9 answer names a concrete failure mode and a real tradeoff, grade-3 is a one-line definition). |
| Probe wordings per slot | **done, content-wise; unused in code** | Every question has a `probes` object. STAR questions use exactly `{situation,task,action,result}_missing`; Technical questions use exactly `{definition,mechanism,tradeoff,experience}_missing` (verified: only one key-set per shape across all 30 questions — the schema is consistent). Nothing in `llm.js` or `app.js` reads this object yet (see "Follow-up chosen by rule" above). |
| Tagged by shape and round | **partial** | Tagged by `shape` (STAR/Technical) and `difficulty` (easy/moderate/hard), yes. Not tagged by "round" in the sense `app.js` needs (`behavioral`/`systemDesign`) — see the frontend mismatch above. |
| Question bank file format usable by the app | **not started — this is the actual blocking task** | The content is good; the container is not. Either wrap it in a JS adapter that reconstructs the `getRole`/`getRoundQuestions` contract `app.js` expects, translating domain→round and difficulty→level, or rewrite the relevant parts of `app.js` to consume the new domain-keyed shape directly. This is real design/reconciliation work, not a quick fix — see plan.md Step 0. |

## Submission artifacts

| Task | Status | Notes |
|---|---|---|
| Baseline (Whisper) comparison code | **not started** | `baseline/` contains only a placeholder README. Genuinely isolated (nothing imports from it — verified), which is correct, but the actual comparison code and table don't exist yet. |
| Writeup | **not started** | Not assessed as part of this audit (no writeup draft found in the repo). |
| README accuracy | **not started — currently wrong** | Root `README.md` claims `src/llm.js` and `src/audio.js` are both fully mocked. `src/llm.js` is not — it's fully wired to `llama-server`. Only `src/audio.js` matches the README's description. Fix before anyone re-derives "is llm.js done?" from a stale doc. |

---

## Demo-day risks (flag these regardless of what gets built first)

1. **`sidecar/models/` doesn't exist yet.** `fetch_model.py` needs to run
   (network required, once) before the sidecar can even start. Do this
   well before the demo, not on demo day.
2. **`llama-server` itself is not part of this repo** and wasn't found on
   `PATH` in this environment. Confirm the actual demo machine has it
   built with the Gemma 4 E4B Q4 weights + audio projector loaded, ahead
   of time — this audit could not verify VRAM fit or that the audio
   projector loads correctly, because no server was running to test
   against.
3. **The webcam feature's fake telemetry is a live risk**, not just dead
   code — if a judge enables the webcam toggle during a demo, "Aesthetic
   Noise: Low (0.02)" is visibly fabricated on screen. Remove before any
   run-through with judges, independent of everything else.
4. **The question bank being unloadable is currently a full frontend
   outage** — anyone pulling this branch right now cannot get past the
   setup wizard. If a teammate is still "working on the frontend"
   unaware of this, they're building on top of a page that doesn't load.
   Surface this immediately, don't let it surprise someone mid-demo-prep.
