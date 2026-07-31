"""Decides where to cut the microphone stream into transcribable chunks.

Three ways a chunk ends, in order of preference:

  smart_turn    Smart Turn v3 says the speaker finished. The good case.
  pause         The 30s ceiling is here and there is a real pause to cut on.
  force_cut_30s The 30s ceiling is here and the candidate never drew breath.

The third case exists because a candidate can talk for 90 seconds with no
clean pause. Waiting for one would push the chunk past 30s, where llama-server
silently discards the tail — so we cut mid-sentence instead. A garbled word at
the boundary is recoverable; silently losing a third of an answer is not.
"""

from dataclasses import dataclass

import numpy as np

import audio_level
import config


@dataclass(frozen=True)
class Chunk:
    """One emitted segment of audio and why it ended."""

    samples: np.ndarray
    cut_reason: str  # "smart_turn" | "pause" | "force_cut_30s" | "stopped"
    index: int
    # False when every frame was below the pause floor — an empty room rather
    # than a quiet speaker. The two are handled very differently: silence is
    # discarded without comment, quiet speech gets a "too quiet" event.
    has_speech: bool

    @property
    def duration_seconds(self) -> float:
        return len(self.samples) / config.SAMPLE_RATE


class Chunker:
    """Accumulates frames and decides when to cut.

    Cuts are exact and adjacent: the audio after a cut point becomes the head
    of the next chunk, with no gap and no overlap. No sample is ever dropped
    or sent twice.
    """

    def __init__(self, turn_detector):
        self._turn = turn_detector
        self._max_samples = int(config.MAX_CHUNK_SECONDS * config.SAMPLE_RATE)
        self._min_samples = int(config.MIN_CHUNK_SECONDS * config.SAMPLE_RATE)
        self._min_pause_frames = max(1, config.MIN_PAUSE_MS // config.FRAME_MS)
        self._reset()
        self._index = 0

    def _reset(self, carry: np.ndarray | None = None):
        self._buffer = [carry] if carry is not None and carry.size else []
        self._held = int(carry.size) if carry is not None else 0
        self._pause_run = 0
        # Sample offset of the end of the most recent qualifying pause. The
        # latest one is kept rather than the first, so a force-cut falls back
        # to the pause nearest the 30s ceiling and keeps chunks long.
        self._last_pause_end = None
        # Smart Turn is asked about a given pause exactly once. Without this,
        # every frame of a long pause would re-run the model with near-identical
        # audio and the same answer.
        self._turn_checked_this_pause = False
        self._speech_frames = 0

    @property
    def _samples(self) -> np.ndarray:
        if not self._buffer:
            return np.empty(0, dtype=np.float32)
        if len(self._buffer) > 1:
            self._buffer = [np.concatenate(self._buffer)]
        return self._buffer[0]

    def push(self, frame: np.ndarray) -> Chunk | None:
        """Add one 20ms frame. Returns a Chunk when it is time to cut."""
        self._buffer.append(frame)
        self._held += frame.size

        # Track pauses continuously, so a cut candidate is always ready before
        # the ceiling arrives rather than being searched for at the last moment.
        is_pause = audio_level.is_pause_frame(frame)
        if is_pause:
            self._pause_run += 1
            if self._pause_run >= self._min_pause_frames:
                self._last_pause_end = self._held
        else:
            self._pause_run = 0
            self._turn_checked_this_pause = False
            self._speech_frames += 1

        if self._held >= self._max_samples:
            return self._cut_at_ceiling()

        if self._held < self._min_samples:
            return None

        # The speaker has paused: ask Smart Turn whether that was the end of
        # the turn or just a breath. Asked once per pause, never mid-speech.
        if is_pause and self._pause_run >= self._min_pause_frames and not self._turn_checked_this_pause:
            self._turn_checked_this_pause = True
            if self._turn.is_turn_complete(self._samples):
                return self._emit(self._held, "smart_turn")

        return None

    def _cut_at_ceiling(self) -> Chunk:
        """At 30s: prefer the latest real pause, force-cut only if there is none."""
        if self._last_pause_end is not None and self._min_samples <= self._last_pause_end < self._max_samples:
            return self._emit(self._last_pause_end, "pause")
        return self._emit(self._max_samples, "force_cut_30s")

    def _emit(self, cut_at: int, reason: str) -> Chunk:
        samples = self._samples
        cut_at = min(cut_at, samples.size)
        chunk = Chunk(
            samples=samples[:cut_at].copy(),
            cut_reason=reason,
            index=self._index,
            has_speech=self._speech_frames > 0,
        )
        self._index += 1
        # Everything after the cut point starts the next chunk immediately.
        self._reset(carry=samples[cut_at:].copy())
        return chunk

    def flush(self) -> Chunk | None:
        """Emit whatever is buffered — used when the user stops recording."""
        if self._held == 0:
            return None
        return self._emit(self._held, "stopped")

    def reset_pause_tracking(self):
        """Resume after speaker playback without treating it as candidate silence."""
        self._pause_run = 0
        self._last_pause_end = None
        self._turn_checked_this_pause = False
