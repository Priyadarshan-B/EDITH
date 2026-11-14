"""
System telemetry and hardware monitoring endpoints using psutil.
"""

from __future__ import annotations
import os
import psutil
from typing import Dict, Any, List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/system", tags=["System"])


class CPUInfo(BaseModel):
    total_percent: float
    per_cpu_percent: List[float]
    cores_physical: int
    threads_logical: int
    frequency_mhz: float


class MemoryInfo(BaseModel):
    total_gb: float
    available_gb: float
    used_gb: float
    percent: float


class DiskInfo(BaseModel):
    total_gb: float
    free_gb: float
    used_gb: float
    percent: float


class BatteryInfo(BaseModel):
    has_battery: bool
    percent: float
    power_plugged: bool


class SystemTelemetry(BaseModel):
    cpu: CPUInfo
    memory: MemoryInfo
    disk: DiskInfo
    battery: BatteryInfo


@router.get("/telemetry", response_model=SystemTelemetry)
async def get_system_telemetry() -> SystemTelemetry:
    """Returns detailed real-time OS telemetry metrics."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=None)
    per_cpu = psutil.cpu_percent(interval=None, percpu=True)
    freq = psutil.cpu_freq()
    freq_mhz = round(freq.current, 1) if freq else 0.0

    # Memory
    mem = psutil.virtual_memory()
    total_ram = round(mem.total / (1024 ** 3), 2)
    avail_ram = round(mem.available / (1024 ** 3), 2)
    used_ram = round(mem.used / (1024 ** 3), 2)

    # Disk (drive where project or system resides)
    disk = psutil.disk_usage(os.path.splitdrive(os.getcwd())[0] or "C:\\")
    total_disk = round(disk.total / (1024 ** 3), 2)
    free_disk = round(disk.free / (1024 ** 3), 2)
    used_disk = round(disk.used / (1024 ** 3), 2)

    # Battery
    battery = psutil.sensors_battery()
    has_battery = battery is not None
    bat_percent = round(battery.percent, 1) if battery else 100.0
    plugged = battery.power_plugged if battery else True

    return SystemTelemetry(
        cpu=CPUInfo(
            total_percent=cpu_percent,
            per_cpu_percent=per_cpu,
            cores_physical=psutil.cpu_count(logical=False) or 4,
            threads_logical=psutil.cpu_count(logical=True) or 8,
            frequency_mhz=freq_mhz,
        ),
        memory=MemoryInfo(
            total_gb=total_ram,
            available_gb=avail_ram,
            used_gb=used_ram,
            percent=mem.percent,
        ),
        disk=DiskInfo(
            total_gb=total_disk,
            free_gb=free_disk,
            used_gb=used_disk,
            percent=disk.percent,
        ),
        battery=BatteryInfo(
            has_battery=has_battery,
            percent=bat_percent,
            power_plugged=plugged,
        ),
    )
