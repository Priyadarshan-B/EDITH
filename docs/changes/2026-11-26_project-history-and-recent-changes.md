# EDITH Project Changes Summary (Up to 2026-11-26)

This document summarizes all code updates, new features, and bug fixes made in the EDITH project from the initial setup up to **November 26, 2026**, written in simple, plain words.

---

## 1. Core Foundation, LLM Chat, Voice, and Desktop App (2026-11-14)

### When
November 14, 2026 (Initial milestones and early fixes).

### Why
To build EDITH from scratch as a local-first AI assistant with chat, voice input/output, desktop automation, semantic memory, productivity tools, and a Tauri desktop interface.

### How it happened
The project was built in stages (Milestones 1 through 7), starting with the FastAPI backend, SQLite database, and React HUD, then adding voice processing, tool execution, memory, scheduling, and packaging.

### Solution
- **Core & Chat**: Initialized the monorepo with a FastAPI backend, SQLite models, React HUD, dynamic LLM model switching, and chat history persistence (`backend/edith/`, `frontend/`).
- **Voice Pipeline**: Added a decoupled audio worker with wake-word detection, voice activity detection (VAD), `faster-whisper` speech-to-text, Piper TTS, and a reactive HUD visualizer (`voice_worker/`, `frontend/`).
- **Automation & Security**: Added a tool orchestrator with path jailing, dual-channel authorization, desktop/filesystem tools, and a security audit UI.
- **Memory & Productivity**: Added semantic vector memory (RAG), personal productivity tools, a scheduler, reminders, and a developer assistant.
- **Desktop Packaging**: Configured Tauri 2 sidecar, system tray, PyInstaller spec, icons, and launcher scripts (`src-tauri/`, `run_edith.ps1`, `run_edith.bat`).

---

## 2. Early Startup, Windows, Voice, and Hot-Reload Fixes (2026-11-14)

### When
November 14, 2026 (Immediately after initial milestones).

### Why
Several practical issues appeared when running EDITH on Windows and using the voice/chat features daily:
- PowerShell launcher had Unicode encoding errors.
- Vite conflicted with Windows IPv6 ports.
- Missing `os` import caused a runtime error.
- Duplicate imports in `MessageItem` broke frontend cleanliness.
- Speech output read out raw symbols (brackets, URLs, slashes, dashes) and didn't always use a natural female voice.
- Gemini timeouts and Groq model discovery needed smoother handling.
- Developers needed hot auto-reload and an easy way to inspect SQLite tables and personalization logs.

### How it happened
Running the app on Windows exposed platform-specific networking/encoding quirks, and real voice testing showed that raw markdown/symbols sound unnatural when spoken aloud.

### Solution
- **Launcher & Dev Server**: Fixed Unicode encoding in `run_edith.ps1`, bound Vite to IPv4 `127.0.0.1`, and enabled hot auto-reload / polling HMR.
- **Frontend & Error Handling**: Removed duplicate imports in `MessageItem`, fixed the missing `os` import, and added friendly error messages and graceful Gemini timeout handling.
- **Voice & Persona**: Set the Southern English Female (English GB) Piper voice (speed `0.5`) and ResponsiveVoice UK Female TTS fallback, cleaned symbols/URLs/brackets from spoken text (`frontend/src/utils/speech.ts`), and added dynamic operator names via `.env` plus JARVIS/EDITH greetings.
- **Groq & Tools**: Added Groq provider with automatic model discovery and fallbacks (`llama-3.3-70b-versatile` and `llama3-8b`), an interactive SQLite table explorer tab, and a continuous personalization engine with an ON/OFF toggle and collapsible learning logs.

---

## 3. Microservices, 3-Tier LLM Fallback, Vision, News, and Media Tools (2026-11-17)

### When
November 17, 2026 (Commit `8dcc086`).

### Why
EDITH needed broader real-world capabilities (WhatsApp, email, calendar, live news, web search, screen vision, and media control) and more reliable LLM responses when one AI provider fails or hits limits.

### How it happened
Relying on a single LLM provider could stall the assistant if an API key ran out of quota or timed out. At the same time, daily assistant tasks required connecting to external services and seeing the user's screen.

### Solution
- **3-Tier LLM Fallback**: Updated `backend/edith/providers/manager.py`, `cloud_gemini.py`, and `groq_provider.py` to support automatic fallback across providers.
- **New Tools & Services**:
  - Added WhatsApp microservice (`services/whatsapp/server.js`, `backend/edith/tools/whatsapp.py`).
  - Added Calendar, Mail, Media, News, Screen Vision, and Web Search tools (`backend/edith/tools/calendar.py`, `mail.py`, `media.py`, `news.py`, `vision.py`, `web_search.py`).
  - Added background sentinel & notifications (`backend/edith/productivity/sentinel.py`, `notifications.py`).
  - Registered the new tools in `backend/edith/tools/registry.py` and `core/orchestrator.py`, and added tests in `backend/tests/test_communication_and_web_tools.py`.

---

## 4. MCP Server Integration and Credential Management (2026-11-25)

### When
November 25, 2026 (Commit `e5ce28d`).

### Why
To connect EDITH to free Model Context Protocol (MCP) servers while keeping API keys, tokens, and local credential files out of Git.

### How it happened
Hardcoding paths or secrets in `config/mcp_servers.json` would risk leaking sensitive credentials to version control.

### Solution
- Updated `backend/edith/mcp/manager.py` and `backend/edith/config.py` to read MCP credentials and paths from `.env`.
- Updated `config/mcp_servers.json` and `.env.example` with free MCP server configurations.
- Created a gitignored `credentials/` folder (`.gitignore`, `credentials/.gitkeep`) for storing sensitive files safely.

---

## 5. Chat Endpoints, Orchestrator, Model Manager, and Main HUD Updates (2026-11-26)

### When
November 26, 2026 (Commit `72e5cf6`).

### Why
To improve how the core orchestrator, model manager, MCP manager, and productivity tools work together, and to update the main HUD layout and training data.

### How it happened
As more tools and MCP servers were added, the chat API, orchestrator, and provider manager needed better coordination and UI support in the main HUD.

### Solution
- Updated `backend/edith/core/orchestrator.py`, `backend/edith/api/v1/chat.py`, `backend/edith/api/v1/productivity.py`, `backend/edith/providers/manager.py`, `backend/edith/mcp/manager.py`, and `backend/edith/tools/productivity.py`.
- Updated `frontend/src/layouts/MainHUD.tsx`.
- Updated personalization/training files in `data/training/` (`command_patterns.json`, `human_logs.json`, `personal_dataset.jsonl`, `training_status.json`).

---

## 6. Project Documentation Rule (2026-11-26)

### When
November 26, 2026.

### Why
The project owner requested that every code update, new feature, or bug fix be automatically documented in plain, simple words inside the project folder.

### How it happened
Without a persistent rule, future AI sessions would not remember to write a plain-language change log after making edits.

### Solution
- Created `AGENTS.md` in the project root so the rule is always active for every session, requiring a `docs/changes/` document explaining **When**, **Why**, **How it happened**, and **Solution** for every update.
