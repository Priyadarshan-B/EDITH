"""
Voice Activity Detection (VAD) and Endpointing Module.
Calculates real-time audio levels and detects speech start and end boundaries.
"""

from __future__ import annotations
import math
import numpy as np


class VoiceActivityDetector:
    """Adaptive VAD with speech endpointing and audio energy normalization."""

    def __init__(
        self,
        sample_rate: int = 16000,
        energy_threshold: float = 0.015,
        min_silence_duration_ms: int = 700,
    ):
        self.sample_rate = sample_rate
        self.energy_threshold = energy_threshold
        self.min_silence_duration_ms = min_silence_duration_ms
        self.silence_chunks_needed = int(
            (min_silence_duration_ms / 1000.0) * (sample_rate / 1280)
        )
        self.silence_count = 0
        self.is_speech_active = False

    def calculate_rms(self, audio_data: np.ndarray) -> float:
        """Calculates Root-Mean-Square (RMS) volume level (0.0 to 1.0)."""
        if len(audio_data) == 0:
            return 0.0
        # If int16, normalize to float32 -1.0 to 1.0
        if audio_data.dtype == np.int16:
            samples = audio_data.astype(np.float32) / 32768.0
        else:
            samples = audio_data.astype(np.float32)
        
        rms = np.sqrt(np.mean(samples ** 2))
        return float(rms)

    def process_chunk(self, audio_chunk: np.ndarray) -> dict:
        """
        Evaluates an audio frame (e.g. 80ms chunk).
        Returns:
            - rms: normalized energy (0.0 - 1.0)
            - is_speech: whether this chunk contains speech
            - speech_started: transition from silence to speech
            - speech_ended: transition from speech to completed utterance
        """
        rms = self.calculate_rms(audio_chunk)
        has_speech = rms >= self.energy_threshold

        speech_started = False
        speech_ended = False

        if has_speech:
            self.silence_count = 0
            if not self.is_speech_active:
                self.is_speech_active = True
                speech_started = True
        else:
            if self.is_speech_active:
                self.silence_count += 1
                if self.silence_count >= self.silence_chunks_needed:
                    self.is_speech_active = False
                    speech_ended = True
                    self.silence_count = 0

        # Normalized level for frontend visualizer (0 to 100)
        visual_level = min(100, int(rms * 400))

        return {
            "rms": rms,
            "visual_level": visual_level,
            "has_speech": has_speech,
            "speech_started": speech_started,
            "speech_ended": speech_ended,
            "is_speech_active": self.is_speech_active,
        }

    def reset(self):
        self.silence_count = 0
        self.is_speech_active = False

