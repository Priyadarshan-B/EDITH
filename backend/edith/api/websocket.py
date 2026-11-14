"""
Bidirectional WebSocket Event Hub for EDITH.
Streams real-time events, audio status, chat tokens, and system telemetry to frontend clients.
"""

from __future__ import annotations
import asyncio
import json
import time
from typing import Set, Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from loguru import logger
import psutil

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._telemetry_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Active count: {len(self.active_connections)}")
        
        # Start background telemetry broadcaster if not running
        if self._telemetry_task is None or self._telemetry_task.done():
            self._telemetry_task = asyncio.create_task(self._telemetry_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active count: {len(self.active_connections)}")

    async def broadcast(self, message_type: str, payload: Dict[str, Any]):
        """Broadcasts a JSON envelope to all connected clients."""
        if not self.active_connections:
            return

        envelope = {
            "type": message_type,
            "timestamp": int(time.time() * 1000),
            "payload": payload,
        }
        raw_msg = json.dumps(envelope)

        dead_connections = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_text(raw_msg)
            except Exception as e:
                logger.warning(f"Failed to send WS message to client: {e}")
                dead_connections.add(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    async def _telemetry_loop(self):
        """Pushes lightweight telemetry updates to UI clients periodically."""
        try:
            while self.active_connections:
                cpu = psutil.cpu_percent(interval=None)
                mem = psutil.virtual_memory()
                await self.broadcast(
                    "TELEMETRY",
                    {
                        "cpu_percent": cpu,
                        "ram_percent": mem.percent,
                        "ram_used_gb": round(mem.used / (1024 ** 3), 2),
                        "ram_total_gb": round(mem.total / (1024 ** 3), 2),
                    },
                )
                await asyncio.sleep(2)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in telemetry loop: {e}")


manager = ConnectionManager()


@router.websocket("/ws/events")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    import os
    expected_token = os.environ.get("EDITH_AUTH_TOKEN")
    if expected_token and token != expected_token:
        logger.warning("WebSocket handshake rejected: invalid token.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Handle client ping or actions
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG", "timestamp": int(time.time() * 1000)}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket session error: {e}")
        manager.disconnect(websocket)
