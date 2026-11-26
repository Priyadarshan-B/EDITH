"""
Dynamic Hardware Probing & Capability Detection for EDITH.
Detects CPU cores, RAM, CUDA VRAM availability, and chooses execution profiles.
"""

from __future__ import annotations
import shutil
from typing import Dict, Any
import psutil


class HardwareProfiler:
    """Probes system hardware to dynamically select optimal compute modes."""

    @staticmethod
    def detect_capabilities() -> Dict[str, Any]:
        has_cuda = False
        vram_mb = 0
        device_name = "CPU Only"

        # Check for PyTorch CUDA if available
        try:
            import torch
            if torch.cuda.is_available():
                has_cuda = True
                device_name = torch.cuda.get_device_name(0)
                vram_mb = torch.cuda.get_device_properties(0).total_memory // (1024 * 1024)
        except ImportError:
            pass

        # System RAM and CPU specifications
        mem = psutil.virtual_memory()
        total_ram_gb = round(mem.total / (1024 ** 3), 2)
        available_ram_gb = round(mem.available / (1024 ** 3), 2)
        cpu_cores_physical = psutil.cpu_count(logical=False) or 4
        cpu_threads_logical = psutil.cpu_count(logical=True) or 8

        # External tooling presence
        ollama_installed = shutil.which("ollama") is not None

        # Read configured local models so future config changes automatically apply
        try:
            from edith.config import settings
            routing_model = settings.models.local.routing_model or "gemma4:e2b"
            complex_model = settings.models.local.complex_model or "qwen2.5:7b"
        except Exception:
            routing_model = "gemma4:e2b"
            complex_model = "qwen2.5:7b"

        # Determine recommended profile
        if has_cuda and vram_mb >= 3800:
            recommended_profile = "cuda_accelerated"
            whisper_compute = "float16"
            whisper_device = "cuda"
            recommended_model = complex_model
        else:
            recommended_profile = "cpu_efficient"
            whisper_compute = "int8"
            whisper_device = "cpu"
            recommended_model = routing_model

        return {
            "device_name": device_name,
            "has_cuda": has_cuda,
            "vram_mb": vram_mb,
            "total_ram_gb": total_ram_gb,
            "available_ram_gb": available_ram_gb,
            "cpu_cores_physical": cpu_cores_physical,
            "cpu_threads_logical": cpu_threads_logical,
            "ollama_available": ollama_installed,
            "recommended_profile": recommended_profile,
            "recommended_model": recommended_model,
            "whisper_device": whisper_device,
            "whisper_compute": whisper_compute,
        }

