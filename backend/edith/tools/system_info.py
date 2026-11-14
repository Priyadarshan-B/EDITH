"""
System Diagnostic & Hardware Introspection Tool for EDITH.
Queries live CPU load, core topology, RAM headroom, and active compute mode.
"""

from __future__ import annotations
import os
import psutil
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from edith.tools.base import BaseTool, ToolExecutionResult
from edith.security.permissions import ActionRiskTier
from edith.providers.hardware import HardwareProfiler


class SystemDiagnosticParams(BaseModel):
    detailed: bool = Field(default=False, description="Whether to include per-core breakdown.")


class SystemDiagnosticTool(BaseTool):
    name = "system_hardware_diagnostic"
    description = "Performs real-time hardware diagnostics: CPU utilization, RAM headroom, and compute mode."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema = SystemDiagnosticParams

    async def execute(self, detailed: bool = False) -> ToolExecutionResult:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        total_ram_gb = round(mem.total / (1024 ** 3), 2)
        avail_ram_gb = round(mem.available / (1024 ** 3), 2)
        used_ram_gb = round(mem.used / (1024 ** 3), 2)
        ram_percent = mem.percent

        hw = HardwareProfiler.detect_capabilities()
        compute_mode = "CUDA (NVIDIA GPU Accelerated)" if hw.get("has_cuda") else "CPU (int8 Optimized)"

        diag_data = {
            "cpu_percent": f"{cpu_percent}%",
            "ram_used_gb": f"{used_ram_gb} GB / {total_ram_gb} GB ({ram_percent}%)",
            "ram_headroom_gb": f"{avail_ram_gb} GB",
            "compute_mode": compute_mode,
            "physical_cores": hw.get("cpu_cores_physical", 4),
            "logical_threads": hw.get("cpu_threads_logical", 8),
        }

        if detailed:
            diag_data["per_cpu_percent"] = psutil.cpu_percent(interval=None, percpu=True)

        summary_msg = (
            f"Hardware Diagnostic: CPU at {cpu_percent}%, "
            f"RAM headroom {avail_ram_gb} GB available ({ram_percent}% used), "
            f"Compute mode: {compute_mode}."
        )

        return ToolExecutionResult(
            success=True,
            data=diag_data,
            message=summary_msg,
            verified=True,
        )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return True
