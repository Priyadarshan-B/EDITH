"""
Configuration parameters for the decoupled voice subsystem worker.
"""

from pathlib import Path
from pydantic import BaseModel


class AudioDeviceConfig(BaseModel):
    sample_rate: int = 16000
    channels: int = 1
    chunk_samples: int = 1280  # 80ms at 16kHz
    input_device_index: int = None
    output_device_index: int = None


class WakeWordWorkerConfig(BaseModel):
    model_name: str = "hey_edith"
    threshold: float = 0.75
    inference_framework: str = "onnx"


class VADWorkerConfig(BaseModel):
    threshold: float = 0.5
    min_speech_duration_ms: int = 250
    min_silence_duration_ms: int = 700  # End of speech threshold


class STTWorkerConfig(BaseModel):
    model_size: str = "base.en"
    compute_type: str = "int8"
    device: str = "cpu"
    threads: int = 4


class TTSWorkerConfig(BaseModel):
    model_name: str = "en_US-lessac-medium"
    speed: float = 1.0
    volume: float = 1.0


class VoiceWorkerSettings(BaseModel):
    ipc_ws_url: str = "ws://127.0.0.1:18420/ws/events"
    audio: AudioDeviceConfig = AudioDeviceConfig()
    wake_word: WakeWordWorkerConfig = WakeWordWorkerConfig()
    vad: VADWorkerConfig = VADWorkerConfig()
    stt: STTWorkerConfig = STTWorkerConfig()
    tts: TTSWorkerConfig = TTSWorkerConfig()
    models_dir: Path = Path("models/audio")


worker_settings = VoiceWorkerSettings()

