"""
Model Downloader Utility for EDITH Voice Subsystem.
Fetches openWakeWord pretrained models, Piper TTS voices, and Whisper checkpoints for offline operation.
"""

import os
import sys
from pathlib import Path
import urllib.request

MODELS_DIR = Path("models/audio")
WAKEWORD_DIR = MODELS_DIR / "wakeword"
PIPER_DIR = MODELS_DIR / "piper"
WHISPER_DIR = MODELS_DIR / "whisper"


def setup_directories():
    for d in [WAKEWORD_DIR, PIPER_DIR, WHISPER_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    print("✓ Model directories initialized at models/audio/")


def download_piper_voice():
    """Downloads en_US-lessac-medium Piper voice and config."""
    print("\n--- Downloading Piper Neural TTS Voice (en_US-lessac-medium) ---")
    base_url = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium"
    model_name = "en_US-lessac-medium"

    onnx_file = PIPER_DIR / f"{model_name}.onnx"
    json_file = PIPER_DIR / f"{model_name}.onnx.json"

    files = [
        (f"{base_url}/{model_name}.onnx?download=true", onnx_file),
        (f"{base_url}/{model_name}.onnx.json?download=true", json_file),
    ]

    for url, target in files:
        if target.exists():
            print(f"✓ Already present: {target.name}")
        else:
            print(f"Downloading {target.name}...")
            try:
                urllib.request.urlretrieve(url, target)
                print(f"✓ Saved {target.name}")
            except Exception as e:
                print(f"Failed to download {target.name}: {e}")


def download_wakeword_models():
    """Downloads openWakeWord pretrained models."""
    print("\n--- Downloading openWakeWord Models ---")
    try:
        import openwakeword.utils
        openwakeword.utils.download_models()
        print("✓ openWakeWord standard models downloaded successfully.")
    except Exception as e:
        print(f"Notice: openWakeWord model fetch error: {e}")


def main():
    print("=== EDITH Voice Models Setup ===")
    setup_directories()
    download_piper_voice()
    download_wakeword_models()
    print("\n=== Model Setup Complete ===")


if __name__ == "__main__":
    main()

