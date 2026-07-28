"""WebSocket server for the audio sidecar.

Binds 127.0.0.1 only. Nothing here is reachable from the network, and the only
outbound call is to llama-server on localhost. See AGENTS.md rule 2.

Run:  sidecar/.venv/bin/python sidecar/server.py
"""

import asyncio
import json
import sys

import websockets
from websockets.asyncio.server import serve

import audio_level
import capture
import chunker as chunker_mod
import config
import transcribe
import turn_detector

# Loaded once at startup rather than per connection: the ONNX session takes a
# moment to build and there is only ever one microphone.
_detector = None


def _message(msg_type: str, **fields) -> str:
    return json.dumps({"type": msg_type, **fields})


async def _handle_chunk(websocket, chunk):
    """Gate on volume, then transcribe. One chunk in, one message out."""
    # An empty room is not a failed answer. Saying "didn't catch that" once a
    # second at someone who simply is not speaking yet is worse than silence.
    if not chunk.has_speech:
        return

    if audio_level.is_too_quiet(chunk.samples):
        # Never drop a quiet chunk silently. A candidate whose answer vanished
        # with no feedback is worse off than one who wasted a request.
        await websocket.send(_message(
            "too_quiet",
            rmsDbfs=round(audio_level.rms_dbfs(chunk.samples), 1),
            thresholdDbfs=config.TOO_QUIET_RMS_DBFS,
        ))
        return

    loop = asyncio.get_running_loop()
    try:
        text = await loop.run_in_executor(None, transcribe.transcribe, chunk.samples)
    except transcribe.TranscriptionError as err:
        await websocket.send(_message("error", code="transcription_failed", message=str(err)))
        return

    await websocket.send(_message(
        "transcript",
        text=text,
        chunkIndex=chunk.index,
        cutReason=chunk.cut_reason,
        durationSeconds=round(chunk.duration_seconds, 2),
    ))


async def _run_capture(websocket):
    """Capture until the client says stop or disconnects."""
    chunker = chunker_mod.Chunker(_detector)
    async with capture.MicrophoneCapture() as mic:
        async for raw in mic.frames():
            chunk = chunker.push(audio_level.pcm_bytes_to_float32(raw))
            if chunk is not None:
                await _handle_chunk(websocket, chunk)


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
                    capture_task = asyncio.create_task(_run_capture(websocket))
            elif command == "stop":
                if capture_task is not None:
                    capture_task.cancel()
                    capture_task = None
            else:
                await websocket.send(_message("error", code="unknown_command",
                                              message=f"unknown command {command!r}"))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if capture_task is not None:
            capture_task.cancel()


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
