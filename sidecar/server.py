"""WebSocket server for the audio sidecar.

Binds 127.0.0.1 only. Nothing here is reachable from the network, and the only
outbound call is to llama-server on localhost. See AGENTS.md rule 2.

Run:  sidecar/.venv/bin/python sidecar/server.py
"""

import asyncio
import json
import re
import sys
import time

import websockets
from websockets.asyncio.server import serve

import audio_level
import capture
import chunker as chunker_mod
import config
import transcribe
import turn_detector
import tts

# Loaded once at startup rather than per connection: the ONNX session takes a
# moment to build and there is only ever one microphone.
_detector = None


def _message(msg_type: str, **fields) -> str:
    return json.dumps({"type": msg_type, **fields})


_NORMALIZE_WORD = re.compile(r"[^\w]+", re.UNICODE)


def _words(text):
    return text.split()


def _normalized(word):
    return _NORMALIZE_WORD.sub("", word).casefold()


def _common_word_prefix(previous, current):
    count = 0
    for old, new in zip(_words(previous), _words(current)):
        if _normalized(old) != _normalized(new):
            break
        count += 1
    return count


def _committed_overlap(committed, current):
    """Return the committed suffix repeated at the start of ``current``."""
    committed_words = _words(committed)
    current_words = _words(current)
    limit = min(len(committed_words), len(current_words))
    for count in range(limit, 0, -1):
        if all(_normalized(old) == _normalized(new)
               for old, new in zip(committed_words[-count:], current_words[:count])):
            return count
    return 0


def _append_text(before, addition):
    return " ".join(part for part in (before.strip(), addition.strip()) if part)


class RollingTranscriber:
    """Coordinates rolling requests and LocalAgreement transcript state."""

    def __init__(self, websocket, audio_chunker):
        self.websocket = websocket
        self.chunker = audio_chunker
        self.committed = ""
        self.tentative = ""
        self.previous_tick = None
        self.in_flight = None
        self.next_tick = time.monotonic() + config.TICK_SECONDS
        self.turn_index = 0
        self.too_quiet_sent = False

    async def on_frame(self, frame):
        reason = self.chunker.push(frame)
        now = time.monotonic()
        if reason is not None:
            if reason == "force_cut_30s":
                print("WARNING: 30s transcription safety ceiling fired", file=sys.stderr, flush=True)
            await self.finalize(reason)
            return
        if now >= self.next_tick:
            self.next_tick = now + config.TICK_SECONDS
            if self.in_flight is not None:
                print("transcription tick skipped: previous request still running", flush=True)
            else:
                self.in_flight = asyncio.create_task(self._tick())
                self.in_flight.add_done_callback(self._tick_done)

    def _tick_done(self, task):
        self.in_flight = None
        try:
            task.result()
        except Exception as err:
            print(f"transcription tick failed: {err}", file=sys.stderr, flush=True)

    async def _tick(self):
        try:
            await self._transcribe(final=False)
        except transcribe.TranscriptionError as err:
            await self.websocket.send(_message(
                "error", code="transcription_failed", message=str(err)))
            raise

    async def _transcribe(self, final):
        if not self.chunker.has_speech:
            return ""
        samples = self.chunker.samples
        duration = len(samples) / config.SAMPLE_RATE
        if not final and duration < config.MIN_WINDOW_SECONDS:
            return ""
        if audio_level.is_too_quiet(samples):
            if not self.too_quiet_sent:
                self.too_quiet_sent = True
                await self.websocket.send(_message(
                    "too_quiet", rmsDbfs=round(audio_level.rms_dbfs(samples), 1),
                    thresholdDbfs=config.TOO_QUIET_RMS_DBFS,
                ))
            return ""

        started = time.monotonic()
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(None, transcribe.transcribe, samples)
        latency = time.monotonic() - started
        print(f"transcription tick: window={duration:.2f}s latency={latency:.2f}s", flush=True)
        if final:
            return text

        all_words = _words(text)
        overlap_count = _committed_overlap(self.committed, text)
        current_words = all_words[overlap_count:]
        current = " ".join(current_words)
        stable_count = (_common_word_prefix(self.previous_tick, current)
                        if self.previous_tick is not None else 0)
        if stable_count:
            stable = " ".join(current_words[:stable_count])
            self.committed = _append_text(self.committed, stable)
            self.chunker.trim_committed(overlap_count + stable_count, len(all_words))
            # The retained PCM overlap changes the next window's start, so it
            # needs a fresh first pass before another prefix can be trusted.
            self.previous_tick = None
            self.tentative = " ".join(current_words[stable_count:])
        else:
            self.previous_tick = current
            self.tentative = current

        if (self.chunker.duration_seconds >= config.MAX_WINDOW_SECONDS
                and not stable_count and len(current_words) > 2):
            forced_count = len(current_words) - 2
            forced = " ".join(current_words[:forced_count])
            self.committed = _append_text(self.committed, forced)
            self.tentative = " ".join(current_words[forced_count:])
            self.chunker.trim_committed(overlap_count + forced_count, len(all_words))
            self.previous_tick = None
            print("WARNING: forced rolling commit at window cap", file=sys.stderr, flush=True)

        await self.websocket.send(_message(
            "transcript_partial", committed=self.committed, tentative=self.tentative))
        return text

    async def finalize(self, reason):
        if self.in_flight is not None:
            await self.in_flight
        try:
            remaining = await self._transcribe(final=True)
        except transcribe.TranscriptionError as err:
            await self.websocket.send(_message("error", code="transcription_failed", message=str(err)))
            return
        overlap_count = _committed_overlap(self.committed, remaining)
        final_text = _append_text(self.committed, " ".join(_words(remaining)[overlap_count:]))
        await self.websocket.send(_message(
            "transcript", text=final_text, chunkIndex=self.turn_index,
            cutReason=reason, durationSeconds=round(self.chunker.duration_seconds, 2),
        ))
        self.turn_index += 1
        self.committed = ""
        self.tentative = ""
        self.previous_tick = None
        self.too_quiet_sent = False
        self.chunker.reset_turn()
        self.next_tick = time.monotonic() + config.TICK_SECONDS


async def _run_capture(mic, rolling, websocket):
    """Continuously drain pw-record and schedule rolling transcriptions."""
    silence_frames = 0
    silence_sent = False
    has_spoken_yet = False
    was_muted = False
    async for raw in mic.frames():
        frame = audio_level.pcm_bytes_to_float32(raw)
        if tts.capture_is_muted():
            was_muted = True
            continue
        if was_muted:
            rolling.chunker.reset_pause_tracking()
            silence_frames = 0
            was_muted = False
        if audio_level.is_pause_frame(frame):
            silence_frames += 1
            if not silence_sent and silence_frames * config.FRAME_MS / 1000 >= config.SILENCE_NUDGE_SECONDS:
                await websocket.send(_message("silence", seconds=round(
                    silence_frames * config.FRAME_MS / 1000, 2), hasSpokenYet=has_spoken_yet))
                silence_sent = True
        else:
            silence_frames = 0
            has_spoken_yet = True
        await rolling.on_frame(frame)


def _report_capture_failure(websocket, task):
    """Surface capture failures instead of leaving the browser listening forever."""
    try:
        task.result()
    except asyncio.CancelledError:
        return
    except Exception as err:
        async def send_error():
            try:
                await websocket.send(_message(
                    "error", code="capture_failed", message=str(err)))
            except websockets.exceptions.ConnectionClosed:
                pass

        asyncio.create_task(send_error())


async def _speak(websocket, text):
    started = False
    async def notify_started():
        nonlocal started
        started = True
        await websocket.send(_message("speaking_started"))

    try:
        await tts.speak(text, notify_started)
    except tts.TTSUnavailable as err:
        await websocket.send(_message("error", code="tts_unavailable", message=str(err)))
    except tts.TTSFailed as err:
        await websocket.send(_message("error", code="tts_failed", message=str(err)))
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as err:
        await websocket.send(_message("error", code="tts_failed", message=str(err)))
    finally:
        if started:
            try:
                await websocket.send(_message("speaking_finished"))
            except websockets.exceptions.ConnectionClosed:
                pass


async def handler(websocket):
    origin = websocket.request.headers.get("Origin")
    if origin is not None and origin not in config.ALLOWED_ORIGINS:
        await websocket.close(code=1008, reason="origin not allowed")
        return

    await websocket.send(_message(
        "ready",
        sampleRate=config.SAMPLE_RATE,
        maxChunkSeconds=config.MAX_CHUNK_SECONDS,
    ))

    capture_task = None
    chunker = None
    rolling = None
    mic = None
    speak_task = None
    try:
        async for raw_message in websocket:
            try:
                command = json.loads(raw_message).get("type")
            except json.JSONDecodeError:
                await websocket.send(_message("error", code="bad_message",
                                              message="expected a JSON object with a type field"))
                continue

            if command == "start":
                if capture_task is None or capture_task.done():
                    chunker = chunker_mod.Chunker(_detector)
                    rolling = RollingTranscriber(websocket, chunker)
                    try:
                        mic = capture.MicrophoneCapture()
                        await mic.__aenter__()
                    except Exception as err:
                        try:
                            await websocket.send(_message(
                                "error", code="capture_failed", message=str(err)))
                        finally:
                            chunker = None
                            rolling = None
                            mic = None
                        continue
                    capture_task = asyncio.create_task(_run_capture(mic, rolling, websocket))
                    capture_task.add_done_callback(
                        lambda task: _report_capture_failure(websocket, task))
            elif command == "stop":
                if mic is None:
                    # No live capture — a previous start failed to spawn one.
                    # Acknowledge anyway so the client's drain does not have to
                    # sit through its timeout waiting for a stop that is done.
                    await websocket.send(_message("stopped"))
                elif capture_task is not None:
                    try:
                        # Terminating pw-record makes frames() consume all bytes already
                        # buffered in stdout before it observes EOF. Do not cancel this
                        # task: pending rolling transcription needs the final frames.
                        mic.stop()
                        try:
                            await capture_task
                        except Exception:
                            # The done callback has already reported this to the client;
                            # still drain any chunks captured before the failure.
                            pass
                        await rolling.finalize("stopped")
                        await mic.__aexit__(None, None, None)
                    finally:
                        capture_task = None
                        chunker = None
                        rolling = None
                        mic = None
                        try:
                            await websocket.send(_message("stopped"))
                        except websockets.exceptions.ConnectionClosed:
                            pass
            elif command == "speak":
                text = json.loads(raw_message).get("text")
                if not isinstance(text, str) or not text.strip():
                    await websocket.send(_message("error", code="tts_failed", message="expected non-empty text"))
                else:
                    speak_task = asyncio.create_task(_speak(websocket, text))
            elif command == "stop_speaking":
                await tts.stop()
            else:
                await websocket.send(_message("error", code="unknown_command",
                                              message=f"unknown command {command!r}"))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if capture_task is not None:
            capture_task.cancel()
        if capture_task is not None:
            await asyncio.gather(
                capture_task,
                return_exceptions=True,
            )
        if rolling is not None and rolling.in_flight is not None:
            rolling.in_flight.cancel()
            await asyncio.gather(rolling.in_flight, return_exceptions=True)
        if mic is not None:
            await mic.__aexit__(None, None, None)
        if speak_task is not None:
            await tts.stop()


async def main():
    global _detector
    try:
        _detector = turn_detector.TurnDetector()
    except FileNotFoundError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1

    async with serve(handler, config.WS_HOST, config.WS_PORT):
        print(
            f"audio sidecar listening on ws://{config.WS_HOST}:{config.WS_PORT} — "
            f"local-only, not reachable from the network"
        )
        print(
            f"  turn detection : {config.SMART_TURN_MODEL} (CPU only, no VRAM)\n"
            f"  transcription  : {config.LLAMA_SERVER_URL}/v1/chat/completions\n"
            f"  audio          : {config.SAMPLE_RATE}Hz mono, "
            f"{config.MAX_CHUNK_SECONDS:.0f}s hard chunk ceiling",
            flush=True,
        )
        await asyncio.get_running_loop().create_future()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()) or 0)
    except KeyboardInterrupt:
        print("\nsidecar stopped")
