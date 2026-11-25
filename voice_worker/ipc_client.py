"""
IPC Client for Voice Worker.
Connects the decoupled audio subprocess to FastAPI's WebSocket event hub.
"""

from __future__ import annotations
import asyncio
import json
import time
from typing import Callable, Optional, Dict, Any
import websockets
from loguru import logger


class VoiceIPCClient:
    def __init__(self, ws_url: str = "ws://127.0.0.1:18425/ws/events"):
        self.ws_url = ws_url
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False
        self._command_handler: Optional[Callable[[Dict[str, Any]], asyncio.Future | None]] = None
        self._running = False

    def set_command_handler(self, handler: Callable[[Dict[str, Any]], None]):
        self._command_handler = handler

    async def connect_loop(self):
        """Maintains persistent connection with automatic reconnect."""
        self._running = True
        while self._running:
            try:
                logger.info(f"Voice Worker attempting IPC connection to {self.ws_url}...")
                async with websockets.connect(self.ws_url, proxy=None) as ws:
                    self.ws = ws
                    self.is_connected = True
                    logger.info("Voice Worker IPC connected successfully.")

                    # Notify backend that audio worker is ready
                    await self.send_event("VOICE_WORKER_READY", {"status": "online"})

                    # Listen for backend incoming commands (e.g. TTS speech requests)
                    async for message in ws:
                        try:
                            data = json.loads(message)
                            if self._command_handler:
                                if asyncio.iscoroutinefunction(self._command_handler):
                                    await self._command_handler(data)
                                else:
                                    self._command_handler(data)
                        except json.JSONDecodeError:
                            pass

            except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
                self.is_connected = False
                self.ws = None
                logger.warning(f"Voice IPC disconnected ({e}). Retrying in 2 seconds...")
                await asyncio.sleep(2)
            except Exception as e:
                self.is_connected = False
                logger.error(f"Unexpected error in Voice IPC loop: {e}")
                await asyncio.sleep(2)

    async def send_event(self, event_type: str, payload: Dict[str, Any]):
        """Dispatches an audio telemetry event to the FastAPI event broker."""
        if not self.ws or not self.is_connected:
            return

        envelope = {
            "type": event_type,
            "timestamp": int(time.time() * 1000),
            "payload": payload,
        }
        try:
            await self.ws.send(json.dumps(envelope))
        except Exception as e:
            logger.warning(f"Failed to transmit Voice IPC event: {e}")

    def stop(self):
        self._running = False
        if self.ws:
            asyncio.create_task(self.ws.close())

