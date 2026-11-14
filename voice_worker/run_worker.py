"""
Entrypoint for the Decoupled Voice Subsystem Worker.
Executed as an isolated subprocess by the Tauri supervisor or backend.
"""

import sys
import asyncio
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from loguru import logger
from voice_worker.config import worker_settings
from voice_worker.ipc_client import VoiceIPCClient
from voice_worker.engine import VoiceEngine


def main():
    logger.info("Starting EDITH Decoupled Voice Subsystem Worker...")
    ipc = VoiceIPCClient(worker_settings.ipc_ws_url)
    engine = VoiceEngine(ipc)

    try:
        asyncio.run(engine.start())
    except KeyboardInterrupt:
        logger.info("Voice worker stopped by operator.")
    finally:
        engine.stop()


if __name__ == "__main__":
    main()

