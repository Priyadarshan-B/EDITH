# EDITH (Even Dead, I'm The Hero)
**Personal AI Desktop Operating Assistant | Local-First | Voice-Enabled | Intelligent Automation**

Inspired by next-generation assistive intelligence, EDITH is an extensible, privacy-focused, local-first personal AI operating assistant for Windows 11. It blends continuous wake-word listening, local LLM orchestration, verified desktop automation, semantic vector memory, and developer productivity tooling.

---

## 🛠 Tech Stack Overview

- **Desktop Framework**: Tauri 2 (Rust) with System Tray and Spotlight HUD
- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui visual style, Lucide Icons, Zustand
- **Backend & AI Orchestration**: Python 3.11+, FastAPI, Pydantic v2, AsyncIO FSM
- **Relational Storage**: SQLite + SQLAlchemy 2.0 (Async) + aiosqlite
- **Vector Database & Embeddings**: ChromaDB + FastEmbed (`all-MiniLM-L6-v2` / `bge-small-en-v1.5`)
- **Local LLM Runtime**: Ollama (Qwen 2.5 3B / 7B, Llama 3.2) + Cloud Provider Fallback (Google Gemini)
- **Dynamic Hardware Adaptation**: Automatic hardware profiling (Zen 2 CPU int8 vs CUDA VRAM float16)
- **Voice Subsystem**: Process-isolated worker with openWakeWord, Silero VAD, faster-whisper, Piper TTS, and Acoustic Echo Guard
- **Desktop Automation**: PyWin32, PyAutoGUI, Windows UI Automation, psutil
- **Security & Authorization**: Path Jail Sandbox, Command Sanitizer, 4-Tier Risk Classification, GUI/Voice dual-channel confirmation, Security Audit Logging
- **Productivity & Scheduling**: APScheduler, Windows Action Center native toast notifications, Daily Briefing synthesizer

---

## 🚀 One-Click Launch

Double-click `run_edith.bat` or run in PowerShell:
```powershell
.\run_edith.ps1
```
This automatically launches:
1. Python FastAPI AI Core Backend (`http://127.0.0.1:18420`)
2. Process-isolated Voice Worker (Wake-word detection + STT + TTS)
3. React 18 Holographic HUD frontend (`http://localhost:1420`)

---

## 🧪 Testing & Verification

Run the comprehensive 25-test backend verification suite:
```powershell
.\.venv\Scripts\pytest.exe -v
```
Build the production frontend bundle:
```powershell
cd frontend
npm run build
```

---

## 📂 Project Architecture

```
EDITH/
├── config/                 # Application settings and security policies
│   ├── default_config.yaml
│   └── security_policies.yaml
├── backend/                # FastAPI backend & AI orchestration engine
│   ├── edith/
│   │   ├── api/v1/         # REST API routes (chat, system, actions, memory, productivity)
│   │   ├── core/           # Native AI Orchestrator & Tool Intent Parser
│   │   ├── memory/         # SQLite models, ChromaDB vector store, FastEmbed, heuristic extractor
│   │   ├── productivity/   # APScheduler, Windows Action Center toast notifications
│   │   ├── providers/      # Hardware profiler, Ollama, and Cloud LLM managers
│   │   ├── security/       # Path Jail, Command Sanitizer, Permission Guard, Audit Logger
│   │   └── tools/          # Desktop, Filesystem, Terminal, and Developer inspection tools
│   └── tests/              # 25 automated pytest tests
├── frontend/               # React 18 + TypeScript + Tailwind UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/       # Conversation sidebar, message parser, interactive cards
│   │   │   ├── hud/        # Model selector dropdown, telemetry cards, status pills
│   │   │   ├── memory/     # Semantic vector memory management & query sandbox
│   │   │   ├── productivity/# Task Kanban, Reminders countdown, Git & directory tree inspector
│   │   │   ├── security/   # Security audit tab & Action authorization challenge modal
│   │   │   ├── system/     # Hardware profile & system diagnostics tab
│   │   │   └── voice/      # Responsive holographic audio orb
│   │   └── layouts/        # Main HUD layout & Spotlight overlay
├── src-tauri/              # Tauri 2 Desktop Shell with System Tray & Sidecar configuration
├── voice_worker/           # Decoupled voice worker (openWakeWord, Silero VAD, faster-whisper, Piper)
├── scripts/                # Build sidecar, PyInstaller spec, icon generator, model downloader
├── run_edith.ps1           # Full-stack PowerShell launcher
└── run_edith.bat           # File Explorer launch shortcut
```

---

## 📜 Architectural Documentation

- [System Architecture](file:///C:/Users/user.DESKTOP-8PVJCNB/.gemini/antigravity/brain/6849dd13-c470-4bab-a3a7-72bb160e1a90/EDITH_SYSTEM_ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Security Policies](docs/SECURITY.md)
- [Technology Stack](docs/TECH_STACK.md)
