"""
DPI-aware Windows Win32 Mouse Driver for EDITH Virtual Mouse.
Receives normalized coordinates and gestures from the frontend MediaPipe JS
WebRTC hand tracker and executes native global Windows input via user32.SendInput.
"""

from __future__ import annotations
import ctypes
from ctypes import wintypes
import threading
import time
from typing import Optional, Dict, Any
from loguru import logger

INPUT_MOUSE = 0
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_HWHEEL = 0x01000
MOUSEEVENTF_ABSOLUTE = 0x8000


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class _INPUT_UNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [
        ("type", wintypes.DWORD),
        ("union", _INPUT_UNION),
    ]


class Win32MouseDriver:
    """DPI-aware native Windows mouse driver via user32.SendInput."""

    def __init__(self):
        self._user32 = ctypes.windll.user32
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            try:
                self._user32.SetProcessDPIAware()
            except Exception:
                pass

    def screen_size(self) -> tuple[int, int]:
        w = self._user32.GetSystemMetrics(0) or 1920
        h = self._user32.GetSystemMetrics(1) or 1080
        return int(w), int(h)

    def _send(self, dx: int, dy: int, data: int, flags: int):
        inp = INPUT(
            type=INPUT_MOUSE,
            union=_INPUT_UNION(
                mi=MOUSEINPUT(
                    dx=dx,
                    dy=dy,
                    mouseData=ctypes.c_uint32(data & 0xFFFFFFFF).value,
                    dwFlags=flags,
                    time=0,
                    dwExtraInfo=None,
                )
            ),
        )
        self._user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    def move_normalized(self, nx: float, ny: float):
        nx = max(0.0, min(1.0, nx))
        ny = max(0.0, min(1.0, ny))
        ax = int(nx * 65535)
        ay = int(ny * 65535)
        self._send(ax, ay, 0, MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE)

    def left_down(self):
        self._send(0, 0, 0, MOUSEEVENTF_LEFTDOWN)

    def left_up(self):
        self._send(0, 0, 0, MOUSEEVENTF_LEFTUP)

    def left_click(self):
        self.left_down()
        self.left_up()

    def double_click(self):
        self.left_click()
        time.sleep(0.04)
        self.left_click()

    def right_click(self):
        self._send(0, 0, 0, MOUSEEVENTF_RIGHTDOWN)
        self._send(0, 0, 0, MOUSEEVENTF_RIGHTUP)

    def scroll(self, delta_wheel: int):
        if delta_wheel != 0:
            self._send(0, 0, delta_wheel, MOUSEEVENTF_WHEEL)

    def hscroll(self, delta_wheel: int):
        if delta_wheel != 0:
            self._send(0, 0, delta_wheel, MOUSEEVENTF_HWHEEL)


class VirtualMouseController:
    """State & Win32 input dispatcher for the hybrid MediaPipe JS virtual mouse."""

    def __init__(self):
        self._lock = threading.Lock()
        self._driver = Win32MouseDriver()
        self._enabled = False
        self._camera_index = 0
        self._sensitivity = 1.25
        self._smoothing = 0.35
        self._deadzone = 4.0
        self._scroll_speed = 1.0
        self._drag_enabled = True
        self._mirror = True
        self._current_gesture = "idle"
        self._last_error: Optional[str] = None
        self._is_dragging = False

    def status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "enabled": self._enabled,
                "running": self._enabled,
                "engine": "mediapipe-js-win32",
                "camera_index": self._camera_index,
                "sensitivity": self._sensitivity,
                "smoothing": self._smoothing,
                "deadzone": self._deadzone,
                "scroll_speed": self._scroll_speed,
                "drag_enabled": self._drag_enabled,
                "mirror": self._mirror,
                "gesture": self._current_gesture,
                "preview_available": self._enabled,
                "last_error": self._last_error,
            }

    def start(self, camera_index: int = 0, sensitivity: Optional[float] = None) -> Dict[str, Any]:
        with self._lock:
            self._camera_index = camera_index
            if sensitivity is not None:
                self._sensitivity = max(0.5, min(2.5, sensitivity))
            self._last_error = None
            self._enabled = True
            self._current_gesture = "initializing"
        logger.info("Hybrid Virtual Mouse enabled (MediaPipe JS + Win32 SendInput).")
        return self.status()

    def stop(self) -> Dict[str, Any]:
        with self._lock:
            was_dragging = self._is_dragging
            self._is_dragging = False
            self._enabled = False
            self._current_gesture = "idle"
        if was_dragging:
            try:
                self._driver.left_up()
            except Exception:
                pass
        logger.info("Hybrid Virtual Mouse disabled.")
        return self.status()

    def update_config(
        self,
        camera_index: Optional[int] = None,
        sensitivity: Optional[float] = None,
        smoothing: Optional[float] = None,
        deadzone: Optional[float] = None,
        scroll_speed: Optional[float] = None,
        drag_enabled: Optional[bool] = None,
        mirror: Optional[bool] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            if camera_index is not None:
                self._camera_index = max(0, min(5, camera_index))
            if sensitivity is not None:
                self._sensitivity = max(0.5, min(2.5, sensitivity))
            if smoothing is not None:
                self._smoothing = max(0.1, min(0.9, smoothing))
            if deadzone is not None:
                self._deadzone = max(0.0, min(20.0, deadzone))
            if scroll_speed is not None:
                self._scroll_speed = max(0.3, min(3.0, scroll_speed))
            if drag_enabled is not None:
                self._drag_enabled = drag_enabled
            if mirror is not None:
                self._mirror = mirror
        return self.status()

    def handle_event(self, payload: Dict[str, Any]):
        """Executes a mouse action received from the frontend MediaPipe hand tracker."""
        with self._lock:
            if not self._enabled:
                return
            gesture = payload.get("gesture")
            if gesture:
                self._current_gesture = str(gesture)
            err = payload.get("error")
            if err:
                self._last_error = str(err)

        action = payload.get("action")
        if not action:
            return

        if action == "move":
            nx = float(payload.get("nx", 0.5))
            ny = float(payload.get("ny", 0.5))
            self._driver.move_normalized(nx, ny)
        elif action == "left_click":
            self._driver.left_click()
        elif action == "double_click":
            self._driver.double_click()
        elif action == "right_click":
            self._driver.right_click()
        elif action == "drag_start":
            with self._lock:
                self._is_dragging = True
            self._driver.left_down()
        elif action == "drag_end":
            with self._lock:
                self._is_dragging = False
            self._driver.left_up()
        elif action == "scroll":
            dy = int(payload.get("dy", 0))
            dx = int(payload.get("dx", 0))
            if dy:
                self._driver.scroll(dy)
            if dx:
                self._driver.hscroll(dx)


virtual_mouse = VirtualMouseController()
