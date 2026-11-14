"""
Text-to-Speech (TTS) Subsystem using Piper TTS.
Provides offline neural voice generation with echo cancellation gating.
"""

from __future__ import annotations
import io
import wave
import threading
from pathlib import Path
from typing import Optional, Callable
import numpy as np
from loguru import logger

from voice_worker.config import TTSWorkerConfig


class SpeechSynthesizer:
    def __init__(self, config: Optional[TTSWorkerConfig] = None):
        self.config = config or TTSWorkerConfig()
        self.is_speaking = False
        self._stop_event = threading.Event()
        self.piper_voice = None
        self._init_voice()

    def _init_voice(self):
        """Initializes Piper TTS model if present."""
        try:
            from piper import PiperVoice
            voice_dir = Path("models/audio/piper")
            model_path = voice_dir / f"{self.config.model_name}.onnx"
            config_path = voice_dir / f"{self.config.model_name}.onnx.json"

            if model_path.exists() and config_path.exists():
                self.piper_voice = PiperVoice.load(str(model_path), config_path=str(config_path))
                logger.info(f"Loaded Piper voice: {model_path}")
            else:
                logger.info(f"Piper voice files not found at {model_path}. TTS will operate in fallback mode.")
                self.piper_voice = None
        except Exception as e:
            logger.warning(f"Could not load Piper voice: {e}")
            self.piper_voice = None

    def synthesize_wav_bytes(self, text: str) -> bytes:
        """Synthesizes text into raw WAV bytes."""
        if not text.strip():
            return b""

        if self.piper_voice:
            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wav_file:
                self.piper_voice.synthesize(text, wav_file)
            return wav_io.getvalue()
        else:
            # Fallback simulated tone/audio if model not yet downloaded
            return b""

    def play_audio(
        self,
        text: str,
        on_start: Optional[Callable[[], None]] = None,
        on_finish: Optional[Callable[[], None]] = None,
    ):
        """Plays synthesized speech in a background thread with acoustic gating."""
        if not text.strip():
            return

        def _play_worker():
            self.is_speaking = True
            self._stop_event.clear()

            if on_start:
                try:
                    on_start()
                except Exception:
                    pass

            logger.info(f"[EDITH Speaking]: '{text}'")

            try:
                # Play audio via sounddevice if piper available
                wav_bytes = self.synthesize_wav_bytes(text)
                if wav_bytes:
                    import sounddevice as sd
                    with io.BytesIO(wav_bytes) as bio:
                        with wave.open(bio, "rb") as wf:
                            sample_rate = wf.getframerate()
                            n_frames = wf.getnframes()
                            audio_bytes = wf.readframes(n_frames)
                            audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                            sd.play(audio_array, samplerate=sample_rate)
                            sd.wait()
                else:
                    # Simulated speech duration based on word count (~150 wpm)
                    import time
                    duration = max(1.0, len(text.split()) / 2.5)
                    elapsed = 0.0
                    while elapsed < duration and not self._stop_event.is_set():
                        time.sleep(0.1)
                        elapsed += 0.1

            except Exception as e:
                logger.error(f"Error during audio playback: {e}")
            finally:
                self.is_speaking = False
                if on_finish:
                    try:
                        on_finish()
                    except Exception:
                        pass

        thread = threading.Thread(target=_play_worker, daemon=True)
        thread.start()

    def stop_playback(self):
        """Barge-in: Interrupt active speech playback immediately."""
        if self.is_speaking:
            logger.info("Interrupting speech playback (Barge-in triggered)...")
            self._stop_event.set()
            try:
                import sounddevice as sd
                sd.stop()
            except Exception:
                pass
            self.is_speaking = False
