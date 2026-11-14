# EDITH – Engineering Roadmap & Milestones

- [x] **Milestone 1: Monorepo Foundation & System Architecture Scaffolding (COMPLETED)**
  - Monorepo directory structure established (`frontend`, `backend`, `src-tauri`, `config`, `docs`).
  - Python 3.11 environment setup with full dependencies.
  - FastAPI asynchronous core backend with health probes and security token middleware.
  - SQLAlchemy 2.0 SQLite relational schema (`conversations`, `messages`, `tasks`, `reminders`, `user_facts`, `security_audit_logs`).
  - HardwareProfiler detecting Ryzen 5 7520U CPU vs GTX 1650 CUDA VRAM.
  - React 18 + TypeScript + Tailwind CSS HUD with real-time telemetry and Spotlight overlay.
  - All 4 backend integration tests verified with Pytest.

- [x] **Milestone 2: LLM Provider Abstraction & Streaming Text Chat (COMPLETED)**
  - Implement base `LLMProvider` interface with abstract async stream and completion contracts.
  - Native Ollama client (`OllamaProvider`) supporting streaming `qwen2.5:3b`, `qwen2.5:7b`, and thread tuning.
  - Cloud provider adapter (`GeminiCloudProvider`) for multimodal fallback.
  - Central `ModelManager` singleton supporting dynamic model switching and discovery.
  - FastAPI chat endpoints (`/api/v1/chat/stream`, `/api/v1/chat/conversations`, `/api/v1/chat/models`).
  - Conversation persistence in SQLite relational store with full message history and cascade deletion.
  - Ultra-premium, user-friendly HUD UI:
    - Dynamic floating `ModelSelector` dropdown in HUD top bar.
    - Collapsible `ConversationSidebar` with search and delete.
    - Full markdown rendering with syntax-highlighted code blocks and one-click "Copy Code".
    - `EmptyState` view with quick starter cards.
  - All 7 Pytest integration tests verified.

- [x] **Milestone 3: Decoupled Voice Pipeline & Hands-Free Audio Loop (COMPLETED)**
  - Decoupled `voice_worker` subprocess (`run_worker.py`, `engine.py`, `ipc_client.py`).
  - Asynchronous IPC client connecting to FastAPI's `/ws/events` for telemetry, audio events, and directives.
  - VAD module (`vad.py`) with RMS calculation, speech start detection, and silence endpointing.
  - Wake-word subsystem (`wakeword.py`) running openWakeWord with threshold scoring and toggle states.
  - Speech-to-text module (`stt.py`) wrapping `faster-whisper` with auto-detected int8 CPU quantization.
  - Text-to-speech module (`tts.py`) wrapping `Piper TTS` with background thread playback and barge-in interruption.
  - Echo cancellation state coordinator (`engine.py`) preventing self-listening feedback loops.
  - Dynamic waveform visualizer and reactive audio orb scaling in frontend (`AudioOrb.tsx`, `App.tsx`).
  - Model downloader script (`scripts/download_models.py`).
  - All 12 integration tests verified across backend and voice subsystems.

- [ ] **Milestone 4: Desktop Automation & Secure Tool Calling Engine**
  - Bespoke native Pydantic tool orchestrator.
  - Implement system tools: App launcher, Window focus/minimize, Media/Volume controls.
  - Implement file tools: Sandboxed file reader, creator, and directory searcher.
  - Dual-channel authorization loop (voice challenge vs Tauri GUI diff card).
  - Post-execution verification engine confirming OS process and filesystem state.

- [ ] **Milestone 5: Semantic Memory & RAG Retrieval**
  - Integrate FastEmbed ONNX (`all-MiniLM-L6-v2`) and ChromaDB vector store.
  - Background asynchronous episodic fact extractor.
  - Semantic similarity search during orchestration planning.
  - User memory management view in frontend.

- [ ] **Milestone 6: Personal Productivity & Developer Assistant**
  - Task and reminder scheduling with APScheduler and Windows OS toasts.
  - Developer tooling: Git status, branch inspection, code explanation, directory tree analysis.
  - Morning debrief synthesizer (calendar, tasks, weather, system health).

- [ ] **Milestone 7: Packaging, Hardening & Production Polish**
  - Package Python backend with PyInstaller into a standalone Tauri sidecar.
  - Production MSI / NSIS installer for clean installation on Windows 11.
  - Zero-touch auto-start in Windows system tray.
  - End-to-end performance and thermal profiling (<3% idle CPU usage).

