"""
Wake-Word Detection Subsystem using openWakeWord.
Continuously processes 80ms audio frames looking for 'Hey EDITH'.
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import Optional, Dict
import numpy as np
from loguru import logger


class WakeWordDetector:
    def __init__(
        self,
        model_name: str = "hey_edith",
        threshold: float = 0.75,
        models_dir: Optional[Path] = None,
    ):
        self.model_name = model_name
        self.threshold = threshold
        self.models_dir = models_dir or Path("models/audio/wakeword")
        self.oww_model = None
        self.is_active = True
        self._init_model()

    def _init_model(self):
        """Initializes openWakeWord model if installed."""
        try:
            import openwakeword
            from openwakeword.model import Model

            # Check if custom model exists or use bundled fallback (e.g. hey jarvis)
            custom_path = self.models_dir / f"{self.model_name}.onnx"
            if custom_path.exists():
                self.oww_model = Model(wakeword_models=[str(custom_path)], inference_framework="onnx")
                logger.info(f"Loaded custom wake word model: {custom_path}")
            else:
                # Use bundled openWakeWord pretrained models if available
                try:
                    self.oww_model = Model(inference_framework="onnx")
                    logger.info("Initialized openWakeWord with standard pretrained models.")
                except Exception as e:
                    logger.warning(f"Default openWakeWord models not ready: {e}")
                    self.oww_model = None

        except ImportError:
            logger.warning("openwakeword library not found. Running in simulation mode.")
            self.oww_model = None
        except Exception as e:
            logger.warning(f"Could not load openWakeWord model: {e}")
            self.oww_model = None

    def predict(self, audio_chunk: np.ndarray) -> Dict[str, float]:
        """
        Runs inference on 16-bit 16kHz mono audio chunk (typically 1280 samples / 80ms).
        Returns mapping of {model_name: confidence_score}.
        """
        if not self.is_active:
            return {}

        if self.oww_model is not None:
            try:
                # Ensure int16
                if audio_chunk.dtype != np.int16:
                    chunk_int16 = (audio_chunk * 32767).astype(np.int16)
                else:
                    chunk_int16 = audio_chunk

                prediction = self.oww_model.predict(chunk_int16)
                return prediction
            except Exception as e:
                logger.error(f"Inference error in openWakeWord: {e}")
                return {}

        return {}

    def is_triggered(self, scores: Dict[str, float]) -> bool:
        """Determines if any wake word confidence score exceeds the threshold."""
        for name, score in scores.items():
            if score >= self.threshold:
                logger.info(f"Wake word detected! Triggered by '{name}' with confidence {score:.2f}")
                return True
        return False

    def set_active(self, active: bool):
        """Enable or disable wake-word listening."""
        self.is_active = active
        if self.oww_model and hasattr(self.oww_model, "reset"):
            self.oww_model.reset()

