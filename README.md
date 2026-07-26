# Offline Interview Coach

A spoken mock-interview app that runs entirely on your machine against
`llama-server` (Gemma). There are no network calls — no cloud API, no
telemetry, no CDN. It works with the network physically off.

This repo is currently the **frontend shell only**. The model and audio layers
are stubbed with mock data so the UI runs end-to-end today.

## What's here

| Path | What it is |
|---|---|
| `index.html` | App shell — sidebar, header, view mount, exit modal, toasts |
| `styles.css` | The whole design system: tokens, layout, components, dark theme |
| `app.js` | SPA router and every view: landing, dashboard, setup wizard, interview, results, history, analytics |
| `question-bank.js` | Role metadata, level rules, and the question-bank **shape**. Every question array is empty — author your own |
| `src/llm.js` | The only place the UI talks to a language model. Returns mock data |
| `src/audio.js` | The only place the UI does speech-to-text or text-to-speech. Returns mock data |
| `vendor/` | Self-hosted Inter + Poppins (woff2) and Lucide icons v0.408.0 |
| `favicon.svg` | Inline SVG icon, no remote fetch |
| `baseline/` | Placeholder for offline comparison code. Not part of the pipeline |

## Running it

No build step and no dependencies. Serve the directory over HTTP — opening
`index.html` as a `file://` URL will break the vendored font loading.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Rounds

Two rounds, both spoken: **Behavioral** and **System Design**. Internally they
are keyed `behavioral` and `systemDesign` in `roundScores` and in the question
bank. There is no MCQ round and no typed coding round — both rounds use the
identical transcript panel that the microphone writes into.

## Current state: everything is mocked

The app is fully clickable but nothing is really scored yet.

- **`src/llm.js`** exposes `evaluate()`, `followup()`, and `recommend()`. Each
  returns hardcoded mock data and is marked `// TODO: wire to llama-server`.
- **`src/audio.js`** exposes `startListening()`, `stopListening()`,
  `isListening()`, `speak()`, and `stopSpeaking()`. `startListening()` replays a
  canned transcript word by word; no microphone is opened.
- **`question-bank.js`** has the right structure with empty arrays. Starting a
  round before authoring questions shows an error toast and returns you to the
  dashboard — that's expected.

The browser `SpeechRecognition` API is deliberately not used: in Chrome it
streams microphone audio to Google's servers, which would break the offline
guarantee.

## Prior work

The frontend shell here was extracted from
[MockMate AI](https://github.com/varadshajith/MockMateAi), an earlier
Express + Prisma + Groq interview app. The backend, auth, MCQ round, coding
editor, and all cloud API code were dropped in the port.

## Attribution

MockMate AI is MIT-licensed; its original copyright notice is retained in
[LICENSE](LICENSE) alongside this project's.

## License

MIT — see [LICENSE](LICENSE).
