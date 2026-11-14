"""
Speech-to-Text (STT) Subsystem using faster-whisper (CTranslate2).
Transcribes audio buffers locally and offline.
"""

from __future__ import annotations
import io
import wave
from pathlib import Path
from typing import Optional
import numpy as np
from loguru import logger

from voice_worker.config import STTWorkerConfig


class SpeechTranscriber:
    def __init__(self, config: Optional[STTWorkerConfig] = None):
        self.config = config or STTWorkerConfig()
        self.model = None
        self._init_model()

    def _init_model(self):
        """Loads faster-whisper model with appropriate quantization."""
        try:
            from faster_whisper import WhisperModel

            logger.info(
                f"Loading faster-whisper model '{self.config.model_size}' "
                f"(Device: {self.config.device}, Compute: {self.config.compute_type}, Threads: {self.config.threads})..."
            )
            self.model = WhisperModel(
                self.config.model_size,
                device=self.config.device,
                compute_type=self.config.compute_type,
                cpu_threads=self.config.threads,
                download_root="models/audio/whisper",
            )
            logger.info("faster-whisper model successfully initialized.")
        except Exception as e:
            logger.warning(f"Could not load faster-whisper model: {e}")
            self.model = None

    def transcribe(self, audio_data: np.ndarray, sample_rate: int = 16000) -> str:
        """
        Transcribes a raw audio buffer (numpy array float32 or int16) into text.
        """
        if self.model is None:
            logger.warning("Whisper model not loaded. Returning empty transcription.")
            return ""

        try:
            # Ensure float32 array normalized to [-1.0, 1.0] as faster-whisper expects
            if audio_data.dtype == np.int16:
                audio_float = audio_data.astype(np.float32) / 32768.0
            else:
                audio_float = audio_data.astype(np.float32)

            segments, info = self.model.transcribe(
                audio_float,
                beam_size=5,
                language="en",
                vad_filter=True,
            )

            transcribed_text = " ".join([seg.text.strip() for seg in segments]).strip()
            logger.info(f"Transcription completed (Duration: {info.duration:.2f}s): '{transcribed_text}'")
            return transcribed_text

        except Exception as e:
            logger.error(f"Error during audio transcription: {e}")
            return ""
