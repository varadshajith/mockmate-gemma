# AGENTS.md

Instructions for anyone — human or AI — working on this repo.

## What this project is

An offline, privacy-first spoken interview coach. Everything runs locally
against `llama-server`. Zero network calls.

## How the repo works

Vanilla JavaScript frontend, served as static files. There is no build step, no
bundler, no `package.json`, and no dependencies to install for the frontend.
You serve the directory over HTTP and open it.

| Path | What it does |
|---|---|
| `index.html` | App shell — sidebar, header, view mount, modals, toasts |
| `app.js` | SPA router and every view: landing, dashboard, setup, interview, results, history, analytics |
| `styles.css` | The whole design system — tokens, layout, components, dark theme |
| `question-bank.js` | Role metadata, level rules, and the interview questions |
| `src/llm.js` | The **only** place the UI talks to a language model. Speaks to `llama-server` on localhost |
| `src/audio.js` | The **only** place the UI does speech-to-text or text-to-speech. Speaks to the local audio sidecar |
| `sidecar/` | Local Python process: captures the mic, detects end-of-turn, transcribes via `llama-server`. Binds `127.0.0.1` only |
| `grammars/*.gbnf` | GBNF grammars that constrain the model's output shape |
| `vendor/` | Self-hosted fonts and icons. Nothing is fetched from a CDN |
| `baseline/` | Placeholder for offline comparison code. Not part of the running app |

### Who is allowed to call the model

There are **exactly two** callers of `llama-server`, and they use different
endpoints for different reasons:

| Caller | Endpoint | What for |
|---|---|---|
| `src/llm.js` | `POST /completion` | Grammar-constrained text — scoring, follow-ups, coaching. Sends a GBNF grammar on every request |
| `sidecar/` | `POST /v1/chat/completions` | Audio transcription — sends base64 wav in an `input_audio` content block |

**No third caller may be added.** If new functionality needs the model, it goes
through one of these two or it does not happen.

**The browser never calls `llama-server` directly for audio.** The page cannot
open a microphone through `pw-record`, so all capture and transcription happens
in the sidecar; `src/audio.js` talks only to the sidecar over a local
WebSocket, and the sidecar talks to `llama-server`.

Two front-end boundaries hold regardless:

- **`src/llm.js` is the text-model boundary.** Every scoring, follow-up, and
  coaching request from the UI goes through it.
- **`src/audio.js` is the audio boundary.** Every microphone read and every
  spoken output goes through it. No other file may touch audio.

There is **no cloud backend, and none may be added.** No server-side API, no
database, no auth service, no hosted inference. If a change seems to need one,
stop and say so instead of building it.

---

## Rule 1 — No fake scoring

All scoring goes through the real model via `src/llm.js`.

Never produce a score from:

- the length of the answer string
- a random number
- keyword or substring matching
- a static lookup table of score-by-level or score-by-difficulty
- any other heuristic that isn't the model's actual judgement

**On any failure — server down, HTTP error, malformed JSON, parse failure —
throw a clear error.** Never fabricate a score and never fall back to a fake
one. It is always better for the UI to say "the local model isn't running"
than to show a candidate a number that means nothing.

A user who sees an invented score has been lied to about their own
performance. That is the single worst thing this app can do, which is why this
is rule 1.

## Rule 2 — Offline only

The app must work with the network physically switched off. Nothing may leave
the machine.

- No CDN links — not for fonts, icons, scripts, or stylesheets. Everything is
  vendored under `vendor/`.
- No external HTTP requests of any kind. **Only `localhost` / `127.0.0.1` is
  allowed** — `llama-server` and the audio sidecar, nothing else.
- No browser APIs that phone home. **The browser `SpeechRecognition` API is
  banned**: in Chrome it streams microphone audio to Google's servers, which
  breaks the offline guarantee outright. It must never be used, not even as a
  fallback when the local pipeline is unavailable. If the sidecar isn't
  running, show an error — do not reach for the browser API.
- No telemetry, analytics, crash reporting, or remote logging.
- The audio sidecar binds to `127.0.0.1` only, never `0.0.0.0`.

## Rule 3 — Safe workflow

- **Plan before non-trivial changes, then wait for an OK** before writing code.
  A short plan that gets corrected early beats a large diff that gets thrown
  away.
- **Flag conflicts instead of guessing.** If an instruction contradicts the
  code, another instruction, or one of these rules, say so and stop. Guessing
  silently is how wrong assumptions get baked in.
- **Keep changes small.** Prefer the narrowest edit that does the job.
- **Don't touch working code unless asked.** Drive-by refactors, renames, and
  "while I was in there" cleanups are not wanted. If something nearby looks
  wrong, mention it rather than fixing it uninvited.
- **Don't commit.** Changes are reviewed and committed by the repo owner.
