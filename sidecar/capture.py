"""Microphone capture via pw-record.

The browser cannot do this — it has no way to spawn a capture process, and the
one API that would work (SpeechRecognition) streams audio to Google. Hence the
sidecar. See AGENTS.md rule 2.
"""

import asyncio
import shutil

import config

# pw-record resamples to 16kHz mono itself, so the format constraint is
# satisfied at the source and no audio library is needed to convert afterwards.
PW_RECORD_ARGS = [
    "--rate", str(config.SAMPLE_RATE),
    "--channels", str(config.CHANNELS),
    "--format", "s16",
    "--raw",
    "-",
]

FRAME_BYTES = config.FRAME_SAMPLES * config.SAMPLE_WIDTH


class CaptureError(RuntimeError):
    pass


class MicrophoneCapture:
    """Async iterator over fixed-size 20ms frames of raw s16le audio."""

    def __init__(self):
        if shutil.which("pw-record") is None:
            raise CaptureError("pw-record not found — is PipeWire installed?")
        self._proc = None

    async def __aenter__(self):
        self._proc = await asyncio.create_subprocess_exec(
            "pw-record", *PW_RECORD_ARGS,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        return self

    async def __aexit__(self, *_exc):
        if self._proc and self._proc.returncode is None:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=2)
            except asyncio.TimeoutError:
                self._proc.kill()
        self._proc = None

    async def frames(self):
        """Yield exactly FRAME_BYTES at a time until the process ends."""
        assert self._proc is not None and self._proc.stdout is not None
        while True:
            try:
                raw = await self._proc.stdout.readexactly(FRAME_BYTES)
            except asyncio.IncompleteReadError:
                stderr = b""
                if self._proc.stderr is not None:
                    stderr = await self._proc.stderr.read()
                if self._proc.returncode not in (0, None, -15):
                    raise CaptureError(
                        f"pw-record exited {self._proc.returncode}: {stderr.decode(errors='replace')[:200]}"
                    )
                return
            yield raw
