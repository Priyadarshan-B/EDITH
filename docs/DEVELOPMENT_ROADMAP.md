# EDITH – Engineering Roadmap & Milestones

- [x] **Milestone 1: Monorepo Foundation & System Architecture Scaffolding (COMPLETED)**
  - Monorepo directory structure established (`frontend`, `backend`, `src-tauri`, `config`, `docs`).
  - Python 3.11 environment setup with full dependencies.
  - FastAPI asynchronous core backend with health probes and security token middleware.
  - SQLAlchemy 2.0 SQLite relational schema (`conversations`, `messages`, `tasks`, `reminders`, `user_facts`, `security_audit_logs`).
  - HardwareProfiler detecting Ryzen 5 7520U CPU vs GTX 1650 CUDA VRAM.
  - React 18 + TypeScript + Tailwind CSS HUD with real-time telemetry and Spotlight overlay.
  - All 4 backend integration tests verified with Pytest.

- [ ] **Milestone 2: LLM Provider Abstraction & Streaming Text Chat**
  - Implement base `LLMProvider` interface.
  - Add native Ollama client (streaming `qwen2.5:3b` and `qwen2.5:7b`).
  - Add optional Cloud fallback provider (Gemini 1.5 Flash / OpenAI).
  - Conversation persistence in SQLite with chat history retrieval.
  - Frontend chat message streaming with markdown rendering and code syntax highlighting.

- [ ] **Milestone 3: Decoupled Voice Pipeline & Hands-Free Audio Loop**
  - Implement isolated `voice_worker` subprocess communicating via local WebSocket IPC.
  - Integrate `openWakeWord` for continuous "Hey EDITH" detection with zero GIL blocking.
  - Integrate `Silero VAD` for speech endpointing and barge-in detection.
  - Integrate `faster-whisper` (CTranslate2 int8 CPU / float16 CUDA).
  - Integrate `Piper TTS` offline voice generation with echo cancellation guard.
  - Live audio waveform and glowing orb feedback in HUD and Spotlight overlay.

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
