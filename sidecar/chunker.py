"""Rolling PCM window and end-of-turn detection for local transcription."""

import numpy as np

import audio_level
import config


class Chunker:
    """Accumulates one turn's rolling audio window.

    Smart Turn remains pause-gated and only returns an end-of-turn signal.
    Rolling transcription ticks are driven by ``server.py``; they never cut
    audio on their own.
    """

    def __init__(self, turn_detector):
        self._turn = turn_detector
        self._turn_ceiling_samples = int(config.MAX_CHUNK_SECONDS * config.SAMPLE_RATE)
        self._min_turn_samples = int(config.MIN_CHUNK_SECONDS * config.SAMPLE_RATE)
        self._min_pause_frames = max(1, config.MIN_PAUSE_MS // config.FRAME_MS)
        self._reset()
        self._index = 0

    def _reset(self):
        self._buffer = []
        self._held = 0
        self._pause_run = 0
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

    def push(self, frame: np.ndarray) -> str | None:
        """Add one 20ms frame and return an end-of-turn reason when detected."""
        self._buffer.append(frame)
        self._held += frame.size

        # Track pauses continuously, so a cut candidate is always ready before
        # the ceiling arrives rather than being searched for at the last moment.
        is_pause = audio_level.is_pause_frame(frame)
        if is_pause:
            self._pause_run += 1
        else:
            self._pause_run = 0
            self._turn_checked_this_pause = False
            self._speech_frames += 1

        if self._held >= self._turn_ceiling_samples:
            # This should be unreachable in normal operation now that rolling
            # commits trim the window. Keep it as a loud safety net.
            return "force_cut_30s"

        if self._held < self._min_turn_samples:
            return None

        # The speaker has paused: ask Smart Turn whether that was the end of
        # the turn or just a breath. Asked once per pause, never mid-speech.
        if is_pause and self._pause_run >= self._min_pause_frames and not self._turn_checked_this_pause:
            self._turn_checked_this_pause = True
            if self._turn.is_turn_complete(self._samples):
                return "smart_turn"

        return None

    @property
    def samples(self) -> np.ndarray:
        """A copy of the rolling window, safe to transcribe off-thread."""
        return self._samples.copy()

    @property
    def duration_seconds(self) -> float:
        return self._held / config.SAMPLE_RATE

    @property
    def has_speech(self) -> bool:
        return self._speech_frames > 0

    def trim_committed(self, committed_words: int, total_words: int):
        """Discard committed audio while retaining a safety overlap.

        Words are not timestamp-aligned, so this is intentionally a
        conservative ratio estimate. The caller resets text agreement after a
        trim; no claim of sample-accurate word boundaries is made here.
        """
        if committed_words <= 0 or total_words <= 0 or self._held == 0:
            return
        estimated = int(self._held * committed_words / total_words)
        safety = int(config.COMMIT_SAFETY_MS * config.SAMPLE_RATE / 1000)
        trim_at = max(0, estimated - safety)
        if trim_at == 0:
            return
        samples = self._samples
        self._buffer = [samples[trim_at:].copy()]
        self._held = self._buffer[0].size

    def reset_turn(self):
        self._reset()

    def reset_pause_tracking(self):
        """Resume after speaker playback without treating it as candidate silence."""
        self._pause_run = 0
        self._turn_checked_this_pause = False
