# Fixture audio — manifest

The Kaggle notebook has **no microphone input**. It reads only the WAV files listed here,
shipped as the `mockmate-fixtures` Kaggle Dataset. These are recordings the team made of
themselves, published deliberately, so that a judge can evaluate the project without a GPU
and without ever handing us their own voice.

> **Status:** the recordings below are specified, not yet recorded. Any row whose
> **Transcript** column still says `— not recorded —` has no WAV in the dataset, and the
> notebook will simply not find it. Do not fill a transcript in from memory or from what the
> answer was *meant* to say — paste what the model actually returned when the fixture was
> first transcribed, and say which run it came from. A transcript written by hand and
> presented as a model output is the same class of lie as a fabricated score (AGENTS.md,
> Rule 1).

---

## Format requirements

Non-negotiable, and enforced by the pipeline rather than by convention:

| Property | Value | Why |
|---|---|---|
| Sample rate | **16 000 Hz** | `llama-server` rejects anything else — 48kHz stereo comes back as HTTP 400 `Failed to tokenize prompt`. See `sidecar/config.py`. |
| Channels | **1 (mono)** | Same reason. |
| Sample width | 16-bit signed (`s16`) | `sidecar/config.SAMPLE_WIDTH` |
| Container | RIFF WAV, uncompressed | Sent as base64 with `"format": "wav"` |
| Duration | **≤ 30.0 s** | `sidecar/config.MAX_CHUNK_SECONDS` is an inviolable ceiling, not a preference. At 60s the model silently truncates the last third of the audio and still reports `finish_reason: "stop"` — the loss is undetectable from the response. |

Record with:

```bash
pw-record --rate 16000 --channels 1 --format s16 backend_easy_2.wav
# or
ffmpeg -i raw.wav -ar 16000 -ac 1 -c:a pcm_s16le backend_easy_2.wav
```

Check before publishing the dataset:

```bash
for f in *.wav; do
  python3 - "$f" <<'PY'
import sys, wave
with wave.open(sys.argv[1]) as w:
    secs = w.getnframes() / w.getframerate()
    ok = w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2 and secs <= 30.0
    print(f"{'OK  ' if ok else 'BAD '} {sys.argv[1]}  {w.getframerate()}Hz {w.getnchannels()}ch "
          f"{w.getsampwidth()*8}bit {secs:.1f}s")
PY
done
```

---

## Naming convention

**The filename stem must be a question `id` from `data/interview_questions.json`.**

`backend_easy_2.wav` → question `backend_easy_2`. Cell 7 of the notebook looks the question up
by that id and grades the answer against that question's authored reference answer. If the stem
does not match any id, the notebook prints a visible `NOTE:` and falls back to the first
question in the file rather than pretending the match was correct.

---

## The fixture set

Six clips. Together they exercise both rubrics, both ends of the score range, and the two
failure modes we most want a judge to be able to see for themselves.

| # | File | Question id | Category | What the recording is | Expected behaviour |
|---|---|---|---|---|---|
| 1 | `backend_easy_2.wav` | `backend_easy_2` — *"What does an index do in a database, and why can't you just index everything?"* | Technical | A **strong** answer: names the mechanism, names the write-amplification cost, grounds it in something built. | Scores high. All four Technical dimensions present, `tradeoff` in particular. `levelSignal` should derive to `step_up` if the score clears 75. This is the notebook's default fixture — cell 7 grades the first WAV it finds. |
| 2 | `backend_easy_1.wav` | `backend_easy_1` — *"What's the difference between SQL and NoSQL databases?"* | Technical | A **memorised-definition** answer: fluent, correct, names no cost, no failure mode, no alternative it was chosen over. | Should score noticeably lower than #1 despite sounding confident. `tradeoff` is the discriminator in `TECHNICAL_RUBRIC`, and this clip exists to show it doing its job. Likely `stay` or `probe`. |
| 3 | `hr_moderate_1.wav` | `hr_moderate_1` — *"Tell me about a time you disagreed with a teammate or manager."* | STAR | A **"we" answer**: describes the team's work in the first person plural throughout, never says what the speaker personally did. | The STAR rubric penalises this explicitly — the *Action* dimension should score low no matter how impressive the project sounds. The most common way an answer sounds strong while saying nothing. |
| 4 | `hr_easy_1.wav` | `hr_easy_1` — *"Tell me about yourself."* | STAR | A **thin** answer, under 15 seconds, no situation and no result. | Should score below 50 with no probe used, so `deriveLevelSignal` returns `probe`. This is the fixture that makes cell 10's threshold demo interesting — feed its score in and the branch that fires is a different one. |
| 5 | `sysdesign_moderate_1.wav` | `sysdesign_moderate_1` — *"How would you design a URL shortener?"* | Technical | A **complexity-bearing** answer that states a concrete design. | `complexity` should come back non-null and describe the design the speaker actually proposed, not a placeholder. The only fixture that exercises that field. |
| 6 | `frontend_easy_1.wav` | `frontend_easy_1` — *"What's the difference between let, const, and var?"* | Technical | The **same words as #2's delivery test**, spoken flat. | Kept as the control for the delivery finding: the model does not hear tone. See the negative-results table — flat vs energetic scored 90 and 90, and the scores swung 18 points between runs on the identical clip. Present so that claim stays checkable rather than remembered. |

---

## Recorded transcripts

Filled in once, from the first successful transcription of each clip, with the run recorded.
Left blank until then.

| File | Duration | Transcript (verbatim model output) | Captured |
|---|---|---|---|
| `backend_easy_2.wav` | — | — not recorded — | — |
| `backend_easy_1.wav` | — | — not recorded — | — |
| `hr_moderate_1.wav` | — | — not recorded — | — |
| `hr_easy_1.wav` | — | — not recorded — | — |
| `sysdesign_moderate_1.wav` | — | — not recorded — | — |
| `frontend_easy_1.wav` | — | — not recorded — | — |

**No expected score is recorded in this table, on purpose.** The "expected behaviour" column
above states which *dimension* each clip is built to exercise; it does not state a number. A
manifest that pins an expected score turns into a lookup table, and a lookup table is exactly
the fake-scoring path AGENTS.md Rule 1 forbids. The score is whatever the model returns on the
day, and the notebook prints that.

---

## What must never be added to this directory

- Any recording of a person who has not agreed to it being published.
- Any recording obtained from a user of the app. The app has no upload path and never will.
- Any clip over 30 seconds — it will be silently truncated and the failure is invisible.
