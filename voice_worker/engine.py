"""
Audio Coordinator Engine and State Machine for EDITH.
Unifies sounddevice input, openWakeWord, Silero VAD, faster-whisper, and Piper TTS.
"""

from __future__ import annotations
import asyncio
import queue
import time
from typing import Optional
import numpy as np
from loguru import logger

from voice_worker.config import worker_settings
from voice_worker.ipc_client import VoiceIPCClient
from voice_worker.wakeword import WakeWordDetector
from voice_worker.vad import VoiceActivityDetector
from voice_worker.stt import SpeechTranscriber
from voice_worker.tts import SpeechSynthesizer


class VoiceEngine:
    def __init__(self, ipc: VoiceIPCClient):
        self.ipc = ipc
        self.state: str = "idle"  # idle, listening, processing, speaking, muted
        self.audio_queue: queue.Queue = queue.Queue(maxsize=100)
        self.utterance_chunks: list[np.ndarray] = []

        # Subsystems
        self.wakeword = WakeWordDetector(
            model_name=worker_settings.wake_word.model_name,
            threshold=worker_settings.wake_word.threshold,
        )
        self.vad = VoiceActivityDetector(
            sample_rate=worker_settings.audio.sample_rate,
            min_silence_duration_ms=worker_settings.vad.min_silence_duration_ms,
        )
        self.stt = SpeechTranscriber(worker_settings.stt)
        self.tts = SpeechSynthesizer(worker_settings.tts)

        self._running = False
        self._input_stream = None

    def _audio_callback(self, indata, frames, time_info, status):
        """sounddevice real-time input stream callback."""
        if status:
            logger.debug(f"Audio stream status: {status}")
        if self._running:
            # Copy chunk to prevent buffer overwrite
            self.audio_queue.put(indata.copy())

    async def handle_backend_command(self, message: dict):
        """Processes commands coming from the FastAPI server."""
        msg_type = message.get("type")
        payload = message.get("payload", {})

        if msg_type == "SYNTHESIZE_AND_PLAY":
            text = payload.get("text", "")
            if text:
                await self.speak_response(text)

        elif msg_type == "CANCEL_PLAYBACK":
            self.tts.stop_playback()
            await self.set_state("idle")

        elif msg_type == "SET_WAKE_WORD_ENABLED":
            enabled = payload.get("enabled", True)
            self.wakeword.set_active(enabled)
            logger.info(f"Wake-word active state set to: {enabled}")

    async def set_state(self, new_state: str):
        """Updates internal state and broadcasts to UI."""
        if self.state != new_state:
            self.state = new_state
            logger.info(f"Voice state transitioned to: [{new_state.upper()}]")
            await self.ipc.send_event("VOICE_STATE_CHANGED", {"state": new_state})

    async def speak_response(self, text: str):
        """Speaks AI response with acoustic feedback suppression."""
        await self.set_state("speaking")
        # Suppress wake word while speaking
        self.wakeword.set_active(False)

        def _on_start():
            pass

        def _on_finish():
            # Restore wake word after playback finishes
            self.wakeword.set_active(True)
            asyncio.run_coroutine_threadsafe(self.set_state("idle"), asyncio.get_event_loop())

        self.tts.play_audio(text, on_start=_on_start, on_finish=_on_finish)

    async def process_audio_loop(self):
        """Main non-blocking audio event loop."""
        self._running = True
        logger.info("Voice processing event loop started.")

        while self._running:
            try:
                # Get next 80ms chunk
                chunk = await asyncio.to_thread(self.audio_queue.get, timeout=0.1)
            except queue.Empty:
                await asyncio.sleep(0.01)
                continue

            # Flatten chunk to 1D
            audio_mono = chunk.flatten()

            # Skip processing if currently speaking (echo protection)
            if self.tts.is_speaking:
                # Check for high-energy barge-in
                vad_res = self.vad.process_chunk(audio_mono)
                if vad_res["rms"] > 0.08:  # User speaking loudly over TTS
                    logger.info("Barge-in detected! Stopping speech playback...")
                    self.tts.stop_playback()
                    await self.set_state("listening")
                    self.utterance_chunks = [audio_mono]
                    self.vad.reset()
                continue

            # State 1: IDLE - Listening for Wake Word ("Hey EDITH")
            if self.state == "idle":
                # Check Wake Word
                scores = self.wakeword.predict(audio_mono)
                if self.wakeword.is_triggered(scores):
                    await self.set_state("listening")
                    await self.ipc.send_event("WAKE_WORD_DETECTED", {"confidence": 0.85})
                    self.utterance_chunks = [audio_mono]
                    self.vad.reset()

            # State 2: LISTENING - Recording speech utterance until endpointing
            elif self.state == "listening":
                self.utterance_chunks.append(audio_mono)
                vad_res = self.vad.process_chunk(audio_mono)

                # Send live visualizer level to UI
                await self.ipc.send_event("AUDIO_LEVEL", {"level": vad_res["visual_level"]})

                # Speech finished (VAD detected trailing silence)
                if vad_res["speech_ended"]:
                    await self.set_state("processing")
                    # Concatenate accumulated audio chunks
                    full_utterance = np.concatenate(self.utterance_chunks)
                    self.utterance_chunks = []

                    # Transcribe via faster-whisper in background thread
                    transcribed_text = await asyncio.to_thread(
                        self.stt.transcribe, full_utterance
                    )

                    if transcribed_text.strip():
                        logger.info(f"User voice command: '{transcribed_text}'")
                        await self.ipc.send_event(
                            "USER_SPEECH_FINAL", {"text": transcribed_text}
                        )
                    else:
                        logger.info("No audible speech transcribed. Returning to idle.")
                        await self.set_state("idle")

            await asyncio.sleep(0.001)

    async def start(self):
        """Initializes sounddevice microphone input stream and starts worker."""
        try:
            import sounddevice as sd
            self._input_stream = sd.InputStream(
                samplerate=worker_settings.audio.sample_rate,
                channels=worker_settings.audio.channels,
                dtype="int16",
                blocksize=worker_settings.audio.chunk_samples,
                callback=self._audio_callback,
            )
            self._input_stream.start()
            logger.info(f"Microphone input stream opened at {worker_settings.audio.sample_rate}Hz.")
        except Exception as e:
            logger.warning(f"Could not open hardware microphone: {e}. Audio will run in simulation mode.")

        # Hook IPC command handler
        self.ipc.set_command_handler(self.handle_backend_command)

        # Run both IPC connection loop and audio processing loop concurrently
        await asyncio.gather(
            self.ipc.connect_loop(),
            self.process_audio_loop(),
        )

    def stop(self):
        self._running = False
        if self._input_stream:
            self._input_stream.stop()
            self._input_stream.close()
        self.ipc.stop()
