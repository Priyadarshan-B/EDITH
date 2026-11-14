"""
Application Configuration Loader for EDITH.
Validates YAML configuration against Pydantic schemas and injects environment overrides.
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import List, Optional
import yaml
from pydantic import BaseModel, Field


class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 18420
    workers: int = 1
    cors_origins: List[str] = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
    ]


class LocalModelConfig(BaseModel):
    routing_model: str = "qwen2.5:3b"
    complex_model: str = "qwen2.5:7b"
    ollama_base_url: str = "http://127.0.0.1:11434"
    context_window: int = 4096
    temperature: float = 0.7


class CloudModelConfig(BaseModel):
    enabled: bool = False
    provider: str = "gemini"
    api_key_env_var: str = "GEMINI_API_KEY"
    model: str = "gemini-1.5-flash"


class ModelsConfig(BaseModel):
    primary_provider: str = "ollama"
    local: LocalModelConfig = Field(default_factory=LocalModelConfig)
    cloud: CloudModelConfig = Field(default_factory=CloudModelConfig)


class WakeWordConfig(BaseModel):
    enabled: bool = True
    model_name: str = "hey_edith"
    threshold: float = 0.75
    inference_framework: str = "onnx"


class VADConfig(BaseModel):
    threshold: float = 0.5
    min_silence_duration_ms: int = 600


class STTConfig(BaseModel):
    provider: str = "faster-whisper"
    model_size: str = "base.en"
    compute_type: str = "int8"
    language: str = "en"


class TTSConfig(BaseModel):
    provider: str = "piper"
    voice_name: str = "en_US-lessac-medium"
    speed: float = 1.0
    volume: float = 1.0


class AudioConfig(BaseModel):
    sample_rate: int = 16000
    channels: int = 1
    chunk_size: int = 1280


class VoiceConfig(BaseModel):
    wake_word: WakeWordConfig = Field(default_factory=WakeWordConfig)
    vad: VADConfig = Field(default_factory=VADConfig)
    stt: STTConfig = Field(default_factory=STTConfig)
    tts: TTSConfig = Field(default_factory=TTSConfig)
    audio: AudioConfig = Field(default_factory=AudioConfig)


class DatabaseConfig(BaseModel):
    sqlite_path: str = "data/edith.db"
    chroma_persist_dir: str = "data/chroma"
    embedding_model: str = "all-MiniLM-L6-v2"


class SecurityConfig(BaseModel):
    strict_jailing: bool = True
    allowed_roots: List[str] = ["%USERPROFILE%", "c:\\Projects"]
    require_voice_confirmation_for_sensitive: bool = True
    require_gui_confirmation_for_destructive: bool = True


class SystemConfig(BaseModel):
    telemetry_interval_seconds: int = 2
    hardware_mode: str = "auto"  # auto, cpu, cuda


class EdithConfig(BaseModel):
    name: str = "EDITH"
    version: str = "0.1.0"
    environment: str = "development"
    debug: bool = True
    server: ServerConfig = Field(default_factory=ServerConfig)
    models: ModelsConfig = Field(default_factory=ModelsConfig)
    voice: VoiceConfig = Field(default_factory=VoiceConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    system: SystemConfig = Field(default_factory=SystemConfig)


def find_project_root() -> Path:
    """Finds the root directory containing config/default_config.yaml."""
    current = Path(__file__).resolve().parent
    for _ in range(4):
        if (current / "config" / "default_config.yaml").exists():
            return current
        current = current.parent
    return Path(os.getcwd())


def load_config(config_path: Optional[str] = None) -> EdithConfig:
    """Loads configuration from YAML file and applies environment overrides."""
    if config_path:
        yaml_file = Path(config_path)
    else:
        root = find_project_root()
        yaml_file = root / "config" / "default_config.yaml"

    config_dict = {}
    if yaml_file.exists():
        with open(yaml_file, "r", encoding="utf-8") as f:
            config_dict = yaml.safe_load(f) or {}

    # Read server host/port overrides from environment if present
    if "EDITH_PORT" in os.environ:
        if "server" not in config_dict:
            config_dict["server"] = {}
        config_dict["server"]["port"] = int(os.environ["EDITH_PORT"])

    if "EDITH_HOST" in os.environ:
        if "server" not in config_dict:
            config_dict["server"] = {}
        config_dict["server"]["host"] = os.environ["EDITH_HOST"]

    return EdithConfig(**config_dict)


# Global singleton instance
settings = load_config()
