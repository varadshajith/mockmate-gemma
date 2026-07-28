"""RMS level helpers, shared by the volume gate and the pause detector."""

import numpy as np

import config

# Floor for the log so digital silence returns a large negative number rather
# than -inf, which would poison any arithmetic downstream.
_SILENCE_FLOOR = 1e-9


def rms_dbfs(samples: np.ndarray) -> float:
    """RMS of float32 samples in [-1, 1], as dBFS. Digital silence -> -180."""
    if samples.size == 0:
        return -180.0
    rms = float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
    return 20.0 * float(np.log10(max(rms, _SILENCE_FLOOR)))


def is_too_quiet(samples: np.ndarray) -> bool:
    """Whole-chunk gate: is this too quiet to be worth transcribing?"""
    return rms_dbfs(samples) < config.TOO_QUIET_RMS_DBFS


def is_pause_frame(frame: np.ndarray) -> bool:
    """Per-frame gate: is this 20ms of silence between words?"""
    return rms_dbfs(frame) < config.PAUSE_RMS_DBFS


def pcm_bytes_to_float32(raw: bytes) -> np.ndarray:
    """s16le bytes as produced by pw-record -> float32 in [-1, 1]."""
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def float32_to_wav_bytes(samples: np.ndarray) -> bytes:
    """Wrap float32 samples in a 16kHz mono WAV container, in memory."""
    import io
    import wave

    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(config.CHANNELS)
        w.setsampwidth(config.SAMPLE_WIDTH)
        w.setframerate(config.SAMPLE_RATE)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()
