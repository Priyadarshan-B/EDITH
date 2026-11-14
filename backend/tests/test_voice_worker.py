"""
Pytest integration test suite for the EDITH Voice Subsystem.
Tests VAD endpointing, wake-word triggering, acoustic feedback gating, and state machine.
"""

import numpy as np
import pytest

from voice_worker.vad import VoiceActivityDetector
from voice_worker.wakeword import WakeWordDetector
from voice_worker.tts import SpeechSynthesizer
from voice_worker.ipc_client import VoiceIPCClient
from voice_worker.engine import VoiceEngine


def test_vad_silence_detection():
    """Verify VAD correctly reports zero energy on pure silence."""
    vad = VoiceActivityDetector(sample_rate=16000, energy_threshold=0.015)
    silence_chunk = np.zeros(1280, dtype=np.int16)

    res = vad.process_chunk(silence_chunk)
    assert res["rms"] == 0.0
    assert res["has_speech"] is False
    assert res["is_speech_active"] is False


def test_vad_speech_start_and_endpointing():
    """Verify VAD detects speech onset and trailing silence endpointing."""
    vad = VoiceActivityDetector(
        sample_rate=16000,
        energy_threshold=0.015,
        min_silence_duration_ms=200,  # fast test
    )

    # 1. Generate active speech audio chunk (440Hz sine wave)
    t = np.linspace(0, 0.08, 1280, endpoint=False)
    speech_signal = (np.sin(2 * np.pi * 440 * t) * 15000).astype(np.int16)

    res_speech = vad.process_chunk(speech_signal)
    assert res_speech["has_speech"] is True
    assert res_speech["speech_started"] is True
    assert res_speech["is_speech_active"] is True
    assert res_speech["visual_level"] > 10

    # 2. Feed silence chunks until speech_ended triggers
    silence_chunk = np.zeros(1280, dtype=np.int16)
    ended = False
    for _ in range(15):
        res = vad.process_chunk(silence_chunk)
        if res["speech_ended"]:
            ended = True
            break

    assert ended is True
    assert vad.is_speech_active is False


def test_wakeword_trigger_logic():
    """Verify openWakeWord confidence evaluation."""
    detector = WakeWordDetector(model_name="hey_edith", threshold=0.75)
    
    # Sub-threshold score
    assert detector.is_triggered({"hey_edith": 0.45}) is False

    # Above threshold score
    assert detector.is_triggered({"hey_edith": 0.82}) is True

    # Disable detection
    detector.set_active(False)
    assert detector.is_active is False


def test_speech_synthesizer_playback_and_barge_in():
    """Verify TTS acoustic gating and barge-in cancellation."""
    tts = SpeechSynthesizer()
    assert tts.is_speaking is False

    # Play short text in background
    tts.play_audio("Testing EDITH voice protocol.")
    import time
    time.sleep(0.1)
    assert tts.is_speaking is True

    # Trigger barge-in stop
    tts.stop_playback()
    assert tts.is_speaking is False


@pytest.mark.asyncio
async def test_voice_engine_state_transitions():
    """Verify audio engine state machine transitions and acoustic echo gating."""
    ipc = VoiceIPCClient(ws_url="ws://127.0.0.1:18420/ws/events")
    engine = VoiceEngine(ipc)

    assert engine.state == "idle"

    # Transition to listening
    await engine.set_state("listening")
    assert engine.state == "listening"

    # Transition to processing
    await engine.set_state("processing")
    assert engine.state == "processing"

    # Transition to speaking (which suppresses wake-word)
    await engine.set_state("speaking")
    assert engine.state == "speaking"

    # Return to idle
    await engine.set_state("idle")
    assert engine.state == "idle"
