"""Offline Piper playback, shared by every sidecar WebSocket connection."""

import asyncio
import os

import config


class TTSUnavailable(RuntimeError):
    pass


class TTSFailed(RuntimeError):
    pass


_playback_lock = asyncio.Lock()
_capture_muted = asyncio.Event()
_active_processes = ()
_stop_requested = False


def capture_is_muted():
    return _capture_muted.is_set()


def _validate():
    if not os.path.isfile(config.PIPER_PATH) or not os.access(config.PIPER_PATH, os.X_OK):
        raise TTSUnavailable(f"Piper was not found at {config.PIPER_PATH}")
    if not os.path.isfile(config.PIPER_MODEL_PATH):
        raise TTSUnavailable(f"Piper voice model was not found at {config.PIPER_MODEL_PATH}")
    if not os.path.isfile(config.PW_PLAY_PATH) or not os.access(config.PW_PLAY_PATH, os.X_OK):
        raise TTSUnavailable(f"pw-play was not found at {config.PW_PLAY_PATH}")


async def stop():
    """Stop the one globally active playback, if any."""
    global _stop_requested
    _stop_requested = True
    for process in _active_processes:
        if process.returncode is None:
            process.terminate()


async def speak(text, on_started):
    """Pipe Piper's raw s16 output directly into pw-play without a temp file."""
    global _active_processes, _stop_requested
    _validate()
    async with _playback_lock:
        _stop_requested = False
        piper = player = None
        started = False
        try:
            piper = await asyncio.create_subprocess_exec(
                config.PIPER_PATH, "--model", config.PIPER_MODEL_PATH, "--output-raw",
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL)
            player = await asyncio.create_subprocess_exec(
                config.PW_PLAY_PATH, *config.PW_PLAY_ARGS, stdin=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL)
            _active_processes = (piper, player)
            _capture_muted.set()
            piper.stdin.write(text.encode("utf-8"))
            await piper.stdin.drain()
            piper.stdin.close()
            await on_started()
            started = True
            while data := await piper.stdout.read(8192):
                player.stdin.write(data)
                await player.stdin.drain()
            player.stdin.close()
            piper_code, player_code = await asyncio.gather(piper.wait(), player.wait())
            if not _stop_requested and (piper_code != 0 or player_code != 0):
                raise TTSFailed(f"Piper playback exited {piper_code}/{player_code}")
            return started
        except (BrokenPipeError, ConnectionResetError):
            if _stop_requested:
                return started
            raise
        except FileNotFoundError as err:
            raise TTSUnavailable(str(err)) from err
        finally:
            _active_processes = ()
            if _capture_muted.is_set():
                await asyncio.sleep(config.TTS_CAPTURE_TAIL_SECONDS)
                _capture_muted.clear()
