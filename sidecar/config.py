"""Tunables for the audio sidecar. Every magic number lives here."""

import os

# --- Audio format ----------------------------------------------------------
# llama-server rejects anything that is not 16kHz mono: 48kHz stereo comes back
# as HTTP 400 "Failed to tokenize prompt". pw-record is asked for this format
# directly, so the resample happens at the source rather than after capture.
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # bytes per sample (s16)

FRAME_MS = 20
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000

# --- Chunk length ----------------------------------------------------------
# 30s is an inviolable ceiling, not a preference. At 60s the model silently
# truncates the last third of the audio and still reports finish_reason
# "stop" — the loss is undetectable from the response. Raising max_tokens does
# not fix it. Never emit a chunk longer than this.
MAX_CHUNK_SECONDS = 30.0
# Below this there is not enough audio for end-of-turn detection to mean much.
MIN_CHUNK_SECONDS = 1.0

# --- Rolling transcription -------------------------------------------------
# Re-transcribe the growing uncommitted tail on this cadence. Repeating audio
# is intentional: agreement between consecutive passes identifies stable text.
TICK_SECONDS = 2.0
# Keep rolling requests short enough that the local model remains responsive.
MAX_WINDOW_SECONDS = 10.0
# Retain this much already-committed audio at a trim boundary for context.
COMMIT_SAFETY_MS = 300
# Do not spend a request on a fragment shorter than this.
MIN_WINDOW_SECONDS = 1.0

# --- Level thresholds ------------------------------------------------------
# These two are deliberately 5dB apart and the ordering is load-bearing.
#
# TOO_QUIET is measured over a whole chunk and rejects it. PAUSE is measured
# per 20ms frame and marks candidate cut points. Because the reject gate sits
# ABOVE the pause floor, any chunk loud enough to be sent necessarily contains
# frames the pause detector scores as speech.
#
# If these were one value, a soft speaker sitting just above the reject line
# would register as continuous pause: no cut candidates would ever be found,
# and every chunk would force-cut at 30s. Keep the gap.
#
# Measured against the recordings in testing/: quietest real speech is
# -34.5 dBFS whole-clip (10.5dB of headroom above TOO_QUIET), while the noise
# floor between words sits at -51 to -54 dBFS (below PAUSE). Digital silence
# is -180 dBFS.
TOO_QUIET_RMS_DBFS = -45.0
PAUSE_RMS_DBFS = -50.0

# A gap shorter than this is a stop consonant, not a pause worth cutting on.
MIN_PAUSE_MS = 300

# --- Smart Turn ------------------------------------------------------------
# v3.1 rather than v3.2: on the mid-sentence-cut recordings in testing/, v3.1
# scores them 0.222 / 0.134 (correctly incomplete) while v3.2 scores the same
# clips 0.949 / 0.786 (incorrectly complete). Upstream's inference.py also
# pins v3.1. Swap this constant to change checkpoint.
SMART_TURN_MODEL = os.environ.get("SMART_TURN_MODEL", "smart-turn-v3.1-cpu.onnx")
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

# The model consumes a fixed 8 second window (input shape [batch, 80, 800] —
# Whisper mel frames at a 10ms hop). Longer audio is truncated to the LAST 8s;
# shorter audio is padded.
SMART_TURN_WINDOW_SECONDS = 8.0

# The single output value is ALREADY a probability in [0,1], despite being
# named "logits" in the ONNX graph. Do not apply a sigmoid to it — doing so
# compresses every result into 0.50-0.73 and destroys the discrimination.
SMART_TURN_THRESHOLD = 0.5

# Smart Turn is a PAUSE CLASSIFIER, not a continuous end-of-turn poller. It is
# asked "was that pause the end of the turn, or is the speaker still thinking?"
# and is only meaningful once the speaker has actually stopped.
#
# Polling it mid-speech asks a question it was not trained on: it returns
# "complete" for almost any input, and the chunker cuts every ~1.2 seconds.
# Upstream's own record_and_predict.py gates it behind a VAD and only calls it
# after a period of trailing silence, which is what MIN_PAUSE_MS does here.
#
# One evaluation per pause, at ~94ms of CPU each.
SMART_TURN_PAUSE_TRIGGER_MS = MIN_PAUSE_MS

# --- Silence and local text-to-speech -------------------------------------
SILENCE_NUDGE_SECONDS = float(os.environ.get("SILENCE_NUDGE_SECONDS", "12.0"))
TTS_CAPTURE_TAIL_SECONDS = float(os.environ.get("TTS_CAPTURE_TAIL_SECONDS", "0.3"))
PIPER_PATH = os.environ.get("PIPER_PATH", "/home/mayur/.local/bin/piper")
PIPER_MODEL_PATH = os.environ.get(
    "PIPER_MODEL_PATH", "/home/mayur/piper/en/en_GB/cori/high/en_GB-cori-high.onnx")
PW_PLAY_PATH = os.environ.get("PW_PLAY_PATH", "/usr/bin/pw-play")
PIPER_SAMPLE_RATE = int(os.environ.get("PIPER_SAMPLE_RATE", "22050"))
PIPER_CHANNELS = int(os.environ.get("PIPER_CHANNELS", "1"))
PW_PLAY_ARGS = ("--rate", str(PIPER_SAMPLE_RATE), "--channels", str(PIPER_CHANNELS),
                "--format", "s16", "--raw", "-")

# --- llama-server ----------------------------------------------------------
LLAMA_SERVER_URL = os.environ.get("LLAMA_SERVER_URL", "http://192.168.137.123:8080")
TRANSCRIBE_TIMEOUT_S = 120

# --- WebSocket -------------------------------------------------------------
# 127.0.0.1 only, never 0.0.0.0 — see AGENTS.md rule 2.
WS_HOST = "127.0.0.1"
WS_PORT = 8765
ALLOWED_ORIGINS = ("http://localhost:8000", "http://127.0.0.1:8000")
