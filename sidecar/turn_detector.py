"""Smart Turn v3 wrapper — semantic end-of-turn detection, CPU only."""

import os

import numpy as np
import onnxruntime as ort
from transformers import WhisperFeatureExtractor

import config


class TurnDetector:
    """Answers one question: has the speaker finished their turn?

    Runs strictly on CPUExecutionProvider. That is not a default we are
    relying on — it is the reason this can share a 6GB card with Gemma
    without competing for VRAM.
    """

    def __init__(self, model_path: str | None = None):
        path = model_path or os.path.join(config.MODEL_DIR, config.SMART_TURN_MODEL)
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Smart Turn model not found at {path}. "
                f"Run: sidecar/.venv/bin/python sidecar/fetch_model.py"
            )
        self._session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        self._features = WhisperFeatureExtractor(chunk_length=int(config.SMART_TURN_WINDOW_SECONDS))
        self._window_samples = int(config.SMART_TURN_WINDOW_SECONDS * config.SAMPLE_RATE)

    def probability(self, samples: np.ndarray) -> float:
        """Probability in [0, 1] that the turn is complete.

        The returned value is used against SMART_TURN_THRESHOLD directly. It
        is already post-sigmoid even though the ONNX output is named "logits";
        applying a sigmoid here would be a bug, not a normalisation.
        """
        window = samples[-self._window_samples:]
        extracted = self._features(
            window,
            sampling_rate=config.SAMPLE_RATE,
            return_tensors="np",
            padding="max_length",
            max_length=self._window_samples,
            truncation=True,
            do_normalize=True,
        ).input_features
        batch = np.expand_dims(extracted.squeeze(0).astype(np.float32), axis=0)
        output = self._session.run(None, {"input_features": batch})
        return float(output[0][0][0])

    def is_turn_complete(self, samples: np.ndarray) -> bool:
        return self.probability(samples) > config.SMART_TURN_THRESHOLD
