# Build Plan — Offline Mock Interview App (Gemma / ML Nashik hackathon)

Audited 2026-07-30. Every claim below was checked against the actual repo
(`git show`, reading full file contents, `node -e` to test parsing) — not
taken from README or teammate claims. Where the repo contradicts the brief,
that's called out explicitly rather than silently resolved.

## Contradiction flags — read these before the plan

These are things the original brief assumed that the repo does not match.
They change the plan, so they come first.

1. **`question-bank.js` is broken right now — it's raw JSON, not JavaScript.**
   `index.html` loads it as `<script src="question-bank.js">`, but the file
   is a bare `{ "_meta": ..., "domains": {...} }` object literal with no
   `const`/`window.` wrapper. Verified: `node -e "require('./question-bank.js')"`
   throws `SyntaxError: Unexpected token ':'`. In a browser this throws the
   same way and halts the script tag. This is not "not wired in yet" — the
   previous commit (`daf9ec8`) deleted the entire helper layer the rest of
   the app depends on: `ROLES`, `LEVEL_RULES`, `getRole()`, `getLevelRules()`,
   `getRoundQuestions()`, all the `window.*` exports. `app.js` calls
   `getRole()` on line 1 of the setup wizard. **The app cannot currently
   reach the dashboard.** This is step 0, ahead of any audio work, because
   nothing else can be demoed until the frontend loads at all.

2. **The question bank's shape doesn't match what `app.js` expects, even once the syntax is fixed.**
   `app.js` wants `QUESTION_BANK[roleId][level][round]` where `round` is
   `behavioral` or `systemDesign`, and each question is
   `{text, hint, modelAnswer}`. The new bank is keyed
   `domains[domainName] -> [ {id, question, shape, reference_answers: {score_9,score_6,score_3}, probes} ]`
   with no `roleId` or `level` at all, and different field names
   (`question` not `text`, no single `modelAnswer`, no `hint`). There are 5
   domains (backend, frontend, genai, hr, system_design), each mostly
   Technical-shaped with one STAR question, except `hr` which is 6/6 STAR.
   This is a real content/schema reconciliation, not a find-and-replace.

3. **The state-card mechanic described in the brief does not exist in code.**
   `src/llm.js:evaluate()` returns a single 0-100 score plus free-text
   `strengths`/`improvements` and a `levelSignal` (`step_up`/`stay`/`probe`/
   `step_down`), constrained by `grammars/evaluate.gbnf`. There is no
   structured per-slot (Situation/Task/Action/Result or Definition/
   Mechanism/Tradeoff/Experience) present/vague/missing output anywhere.

4. **Follow-ups are currently improvised by the model, which the brief explicitly rules out.**
   `LLM.followup()` sends a free-text prompt ("Ask ONE specific clarifying
   follow-up question...") and lets the model write it. The brief says the
   follow-up must be "chosen by code, from a rule... not improvised by the
   model." The question bank actually already has the right raw material for
   the rule-based version — every question ships a `probes` object keyed
   exactly by slot (`definition_missing`, `mechanism_missing`,
   `tradeoff_missing`, `experience_missing` for Technical;
   `situation_missing`, `task_missing`, `action_missing`, `result_missing`
   for STAR) — but nothing in `llm.js` or `app.js` reads `probes` at all.
   Wiring the state card (item 3) is most of the work needed to make this
   rule-based, since the rule needs to know *which* slot was missing.

5. **The webcam/face-analysis feature is still fully present and wired up, in direct violation of the brief's "no face or video analysis" decision.**
   `app.js` has `getUserMedia`-based webcam capture (`activeWebcamStream`,
   `stopActiveCamera()`), a toggle in the setup wizard
   (`toggleSetupWebcam`), and a live interview panel
   (`#interview-webcam-element`) rendering **fabricated** "Eye Contact",
   "Posture Index", and "Aesthetic Noise" telemetry (hardcoded strings like
   `"Stable (98%)"` — not computed from anything). This isn't a missing
   feature to build, it's a leftover MockMate feature that needs deleting,
   and it's a rule-1 violation waiting to happen if a judge asks what
   "Aesthetic Noise: Low (0.02)" is measuring.

6. **No Piper TTS integration exists anywhere in the repo.** Not in
   `sidecar/`, not in `src/audio.js`, not mentioned in any file. `speak()` in
   `src/audio.js` is `console.log` only. The architecture table's "speech
   output" stage is unbuilt from zero, not partially wired.

7. **The README is stale and actively misleading.** It says "everything is
   mocked" and describes `src/llm.js` as returning hardcoded mock data
   marked `// TODO: wire to llama-server`. That is not true — `llm.js` is
   fully wired to `/completion` with real GBNF grammars, real rubrics, and
   real error handling (confirmed by reading the whole file). Only
   `src/audio.js` is still mocked as the README describes. Fix the README
   or someone will burn time re-verifying something already done.

8. **The architecture table says "Smart Turn v2"; the code uses v3.1.**
   `sidecar/config.py` pins `smart-turn-v3.1-cpu.onnx` with a comment
   explaining v3.2 was tested and rejected (scores mid-sentence cuts as
   complete: 0.949/0.786 vs v3.1's correct 0.222/0.134). Code is right,
   the brief's table is just outdated — fix the writeup, not the code.

## What's actually done (verified, not assumed)

- **`src/llm.js` → `llama-server /completion`**: real, complete. Three
  functions (`evaluate`, `followup`, `recommend`), each with a GBNF grammar,
  a real rubric (STAR / Definition-Mechanism-Tradeoff-Experience), retry
  logic for degenerate model output, and hard failure (no fake scores) per
  AGENTS.md rule 1.
- **`sidecar/` audio pipeline**: real, not stubbed. `capture.py` spawns
  `pw-record` at 16kHz mono; `chunker.py` implements the exact 30s ceiling
  logic the brief calls for (`smart_turn` / `pause` / `force_cut_30s` cut
  reasons, with reasoning for why force-cutting beats silent truncation);
  `turn_detector.py` runs Smart Turn v3.1 on ONNX CPU (no VRAM contention,
  confirmed no `torch` in `requirements.txt`); `transcribe.py` posts to
  `/v1/chat/completions` with `enable_thinking: false` (documented
  workaround for a truncation bug); `server.py` is a working WebSocket
  server bound to `127.0.0.1` with origin checking. **This has not been
  run end-to-end against a live `llama-server`** — no test recordings, no
  logs, nothing in the repo proves it works beyond reading correct.
- **`question-bank.js` content**: the actual interview content is
  excellent and matches the brief's grading philosophy closely — 30
  questions, 5 domains, three graded reference answers per question
  (9/6/3), and per-slot probe text ready to be used as the rule-based
  follow-up bank. The content is done; the file format and integration
  are not (see contradiction flags 1–2, 4).
- **Auth**: already absent. No login route, no password/JWT handling
  anywhere in `app.js` — just a `localStorage`-backed profile. Nothing to
  remove here; the brief's "must be removed entirely" is already satisfied.
- **Baseline isolation**: `baseline/` is genuinely empty (just a README)
  and nothing imports from it. Compliant with the Whisper-isolation
  constraint, but the actual comparison code doesn't exist yet.

## Build order

Each step names what it unblocks. Do not skip ahead — later steps assume
earlier ones are actually verified, not just written.

### Step 0 — Un-break the frontend
**Unblocks:** literally everything; the app cannot currently load past the
setup wizard.
Restore a JS wrapper (`ROLES`, `LEVEL_RULES`, helper functions, `window.*`
exports) around the new question content, OR rewrite `app.js`'s
role/level/round lookups to match the new domain-keyed shape directly.
Given the new content doesn't have a role/level axis at all, the lower-risk
path is: keep the new JSON as data, write a thin adapter module that exposes
`getRole`/`getLevelRules`/`getRoundQuestions`-equivalents `app.js` already
calls, translating domain→round and difficulty→level.
**Done when:** `index.html` loads with zero console errors and the setup
wizard reaches the dashboard.

### Step 1 — Prove Gemma audio round-trips at all
**Unblocks:** every audio and grading decision downstream — if this fails,
the whole architecture needs to change, so it goes first among the "new"
work.
Start `llama-server` with the Gemma 4 E4B Q4 + audio projector. Run
`sidecar/fetch_model.py`, then `sidecar/server.py` manually. Record a short
real clip via `pw-record` at 16kHz mono, feed it through
`sidecar/transcribe.py:transcribe()` directly (bypass the WebSocket for this
first test), and confirm a real, non-garbled transcript comes back within
`TRANSCRIBE_TIMEOUT_S`.
**Done when:** one real spoken sentence produces a correct transcript,
logged with actual latency. If this doesn't work, stop and re-plan —
nothing past this point matters until it does.

### Step 2 — Wire `src/audio.js` to the sidecar over WebSocket
**Unblocks:** any real (non-canned) transcript reaching the UI.
Replace the mock interval in `startListening()`/`stopListening()` with a
real WebSocket client to `ws://127.0.0.1:8765`, handling `ready`,
`transcript`, `too_quiet`, and `error` message types from `server.py`.
**Done when:** speaking into the mic during a round produces the real
words in the transcript panel, end to end, with the network switched off.

### Step 3 — Design and implement the state card
**Unblocks:** rule-based follow-up selection (step 4) and everything the
brief calls "the core mechanic."
Add a new grammar + rubric (or extend `evaluate.gbnf`) that returns, per
answer, a structured verdict per slot: `present` / `vague` / `missing` for
each of Situation/Task/Action/Result (STAR) or Definition/Mechanism/
Tradeoff/Experience (Technical), not just a single score. Decide whether
this replaces or sits alongside the existing score+levelSignal contract —
recommend alongside, since round scoring and level-stepping already work
and are demo-load-bearing.
**Done when:** a call to the model with a deliberately incomplete answer
(e.g. states the situation but never says what *they* did) returns a state
card correctly marking Action as missing, verified against the reference
answers already in the question bank (score_3 answers are effectively
"only definition/situation present" by design — use them as test fixtures).

### Step 4 — Rule-based follow-up selection
**Unblocks:** the specific "ask a follow-up about the gap" mechanic the
whole product is judged on.
Replace `LLM.followup()`'s free-text prompt with: read the state card's
first missing/vaguest slot, look up `question.probes[<slot>_missing]` from
the question bank, and ask that verbatim (or with light templating) instead
of generating new text. Enforce the existing max-2-probes-per-question cap
(currently 1-per-round in `app.js` — brief says max 2 per *question*; these
are different caps, reconcile which one is intended before implementing).
**Done when:** an answer that's missing "Action" triggers the exact
`action_missing` probe from that question's bank entry, not a
model-generated question.

### Step 5 — TTS (Piper)
**Unblocks:** a fully spoken interview (currently the UI has no voice
output at all).
Nothing exists yet. Install Piper, pick a voice, wire `speak()` in
`src/audio.js` to it (likely via a small local process/HTTP call, mirroring
how the sidecar is structured — decide whether this lives in the existing
sidecar process or a second one).
**Done when:** the app speaks a question aloud with the network off.

### Step 6 — Warm-up + full interview flow
**Unblocks:** the actual demo script (warm-up → behavioral → technical →
design → close).
No warm-up stage exists today; `app.js` only has a `quickRound` (single
round) demo mode, not an unscored warm-up. Add the warm-up stage per the
brief, and reconcile the two-round (`behavioral`/`systemDesign`) structure
against the brief's three-question-type flow (behavioral / technical /
design) — decide whether "technical" and "design" are two separate rounds
or one combined round drawing from different domains, since the question
bank's domain split (backend/frontend/genai = Technical, system_design =
Technical, hr = STAR) doesn't currently produce three distinct rounds.
**Done when:** a full run goes warm-up → behavioral → technical → design →
close without manual intervention, and demo mode correctly cuts it to
warm-up + one question.

### Step 7 — Remove webcam/face-analysis code
**Unblocks:** nothing technical, but this is a rule violation sitting in
the demo path and should not survive to judging. Do this any time after
Step 0, it has no dependencies.
Delete `activeWebcamStream`, `stopActiveCamera()`, the webcam toggle in
setup, and the `#interview-webcam-element` panel with its fabricated
Eye Contact / Posture Index / Aesthetic Noise readouts.
**Done when:** no `getUserMedia` call remains in the repo.

### Step 8 — Baseline (Whisper) comparison
**Unblocks:** the writeup's comparison table. Lowest priority technical
work; do this last, in parallel with writeup drafting.
Build the isolated Whisper baseline in `baseline/`, run it offline against
the same recordings used in Step 1/3 testing, and produce a comparison
table (latency, accuracy, resource use) for the writeup. Confirm it stays
unimported by anything under `src/`/`app.js`.
**Done when:** a table exists comparing Gemma-audio vs. Whisper on the same
clips, and `grep -r whisper src/ app.js` (case-insensitive) returns nothing.

### Step 9 — README + writeup accuracy pass
**Unblocks:** judging clarity. Do last.
Fix the stale README (item 7) and the Smart Turn version mismatch (item 8)
before anyone reads either for the writeup.

## Fallback ladder

If Step 1 fails or is too slow for the 6GB budget:

1. **Gemma 4 E4B Q4** (current plan) — the audio projector's VRAM cost is
   unverified in this repo; nothing here confirms it fits alongside a full
   context. Test early.
2. **Gemma 4 E2B** — smaller model, same architecture, should free VRAM
   headroom. Same `/completion` and `/v1/chat/completions` contracts,
   should be a config change in `llama-server` invocation only.
3. **A smaller quant of E4B** (Q3 or lower) — quality risk on grading
   accuracy, test the rubric outputs specifically, not just that it runs.
4. **Kaggle T4 notebook** — breaks the "fully offline, demo with wifi off"
   story; only acceptable as a last-resort fallback for the *recording*
   used in the writeup, not for the live demo itself. If this is reached,
   say so explicitly in the writeup rather than implying it's the same
   as the local pipeline.

## Cut line — minimum coherent submission

If time runs out, this is the smallest set that is still a real,
demoable, non-fake submission:

- Step 0 (frontend loads) — non-negotiable, nothing works without it.
- Step 1 (Gemma audio round-trip proven) — non-negotiable, it's the whole
  point of the track.
- Step 2 (real mic → real transcript, no mock) — non-negotiable; a demo
  that plays back a canned transcript is exactly the "fake scoring" rule 1
  is written to prevent, extended to fake listening.
- Step 7 (webcam removed) — non-negotiable; do not let judges find fabricated
  telemetry.
- **Cuttable if forced:** Step 3+4 (state card + rule-based follow-up) can
  degrade to the *current* single-score + model-improvised-followup
  behavior for the demo, clearly labeled in the writeup as "follow-up
  selection is currently model-generated; rule-based selection using the
  question bank's per-slot probes is the next step" — an honest "not done
  yet" beats a broken rule-based version demoed live.
- **Cuttable:** Step 5 (TTS) — a text-displayed question with the
  candidate speaking their answer is still a legitimate, honest demo of
  the audio-understanding half of the pipeline, just not fully spoken.
  Say so in the writeup rather than pretending it's voice-to-voice.
- **Cuttable:** Step 6's full warm-up→close flow — a single scored round
  (what `quickRound` demo mode already supports once Step 0/2 are fixed)
  is enough to prove the mechanic.
- **Cuttable:** Step 8 (baseline table) — nice for the writeup's Innovation
  score, not required for Functionality.
