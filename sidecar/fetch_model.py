"""One-time download of the Smart Turn checkpoint.

This is the only script in the project that touches the network. It is a setup
step, not part of the running app: once the file is vendored into
sidecar/models/, the sidecar runs with HF_HUB_OFFLINE=1 and cannot reach out
even if something tried. See AGENTS.md rule 2.

Run:  sidecar/.venv/bin/python sidecar/fetch_model.py
"""

import os
import sys
import urllib.request

import config

BASE_URL = "https://huggingface.co/pipecat-ai/smart-turn-v3/resolve/main"


def main() -> int:
    os.makedirs(config.MODEL_DIR, exist_ok=True)
    target = os.path.join(config.MODEL_DIR, config.SMART_TURN_MODEL)

    if os.path.exists(target):
        print(f"already present: {target} ({os.path.getsize(target) / 1e6:.1f} MB)")
        return 0

    url = f"{BASE_URL}/{config.SMART_TURN_MODEL}"
    print(f"downloading {config.SMART_TURN_MODEL} ...")
    try:
        urllib.request.urlretrieve(url, target)
    except Exception as err:  # noqa: BLE001 - report whatever went wrong verbatim
        if os.path.exists(target):
            os.remove(target)
        print(f"error: download failed — {err}", file=sys.stderr)
        return 1

    print(f"saved {target} ({os.path.getsize(target) / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
