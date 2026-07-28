"""Transcription client for llama-server.

This is one of exactly two places in the project that talk to the model — the
other is src/llm.js. See AGENTS.md.
"""

import base64
import json
import urllib.error
import urllib.request

import numpy as np

import audio_level
import config

TRANSCRIBE_INSTRUCTION = "Transcribe this audio verbatim. Output only the transcription."


class TranscriptionError(RuntimeError):
    pass


def _build_payload(wav_bytes: bytes) -> dict:
    return {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": TRANSCRIBE_INSTRUCTION},
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": base64.b64encode(wav_bytes).decode("ascii"),
                            "format": "wav",
                        },
                    },
                ],
            }
        ],
        # Measured: at temperature 1.0 roughly 1 request in 5 stalls to ~10s
        # instead of ~2.3s. 0.2 is not a quality preference, it is latency.
        "temperature": 0.2,
        "max_tokens": 512,
        "stream": False,
        #
        # DO NOT REMOVE enable_thinking:false. This is not a performance tweak.
        #
        # With thinking enabled the model spends its token budget on a
        # chain-of-thought block and can exhaust max_tokens before finishing
        # the transcript — returning a TRUNCATED transcript while still
        # reporting finish_reason "stop". That is the same deceptive signature
        # as the >30s audio bug: the response looks complete and is not.
        #
        # Measured on a 30s clip: thinking on -> 512 generated tokens, 10.5s,
        # transcript cut off. Thinking off -> 112 tokens, 2.3s, complete.
        #
        # Do NOT substitute "reasoning_budget": 0. It is silently ignored on
        # this llama-server build and reads as though it works.
        "chat_template_kwargs": {"enable_thinking": False},
    }


def transcribe(samples: np.ndarray) -> str:
    """Transcribe float32 16kHz mono samples. Raises on any failure.

    Never returns a placeholder or a guess — a failed transcription must be
    visible to the caller, not silently replaced with empty text.
    """
    wav_bytes = audio_level.float32_to_wav_bytes(samples)
    request = urllib.request.Request(
        f"{config.LLAMA_SERVER_URL}/v1/chat/completions",
        data=json.dumps(_build_payload(wav_bytes)).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(request, timeout=config.TRANSCRIBE_TIMEOUT_S) as response:
            body = json.load(response)
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")[:300]
        raise TranscriptionError(f"llama-server returned HTTP {err.code}: {detail}") from err
    except urllib.error.URLError as err:
        raise TranscriptionError(
            f"could not reach llama-server at {config.LLAMA_SERVER_URL} — {err.reason}"
        ) from err

    try:
        message = body["choices"][0]["message"]
        text = message["content"]
    except (KeyError, IndexError, TypeError) as err:
        raise TranscriptionError(
            f"unexpected llama-server response shape: {json.dumps(body)[:300]}"
        ) from err

    if not isinstance(text, str):
        raise TranscriptionError(f"transcription was not a string: {text!r}")
    return text.strip()
