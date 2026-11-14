# EDITH (Even Dead, I'm The Hero)
**Personal AI Desktop Operating Assistant | Local-First | Voice-Enabled | Intelligent Automation**

Inspired by next-generation assistive intelligence, EDITH is an extensible, privacy-focused, local-first personal AI operating assistant for Windows 11. It blends continuous wake-word listening, local LLM orchestration, desktop automation, and persistent semantic memory.

---

## 🛠 Tech Stack Overview

- **Desktop Framework**: Tauri 2 (Rust)
- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, Zustand
- **Backend & AI Orchestration**: Python 3.11+, FastAPI, Pydantic v2, AsyncIO FSM
- **Relational Storage**: SQLite + SQLAlchemy 2.0 (Async) + aiosqlite
- **Local LLM Runtime**: Ollama (Qwen 2.5 3B / 7B, Llama 3.2)
- **Dynamic Hardware Adaptation**: Automatic hardware profiling (Zen 2 CPU int8 vs CUDA VRAM float16)
- **Voice Subsystem**: openWakeWord, Silero VAD, faster-whisper, Piper TTS
- **Desktop Automation**: PyWin32, PyAutoGUI, Windows UI Automation, psutil

---

## 🚀 Quick Start (Development)

### Prerequisites
1. **Python 3.11+**
2. **Node.js v20+**
3. **Rust & Cargo** (for building Tauri desktop binaries)
4. **Ollama** (optional for local LLM inference)

### 1. Backend Setup
```powershell
# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r backend/requirements.txt

# Run integration test suite
pytest
```

### 2. Frontend Setup
```powershell
cd frontend
npm install
npm run build
```

### 3. Launching EDITH in Development Mode
```powershell
# In terminal 1 (Backend):
.\.venv\Scripts\python.exe backend/run_backend.py

# In terminal 2 (Frontend):
cd frontend
npm run dev
```

---

## 📂 Project Architecture

```
EDITH/
├── config/                 # Application settings and security policies
├── backend/                # FastAPI backend & AI orchestration engine
│   ├── edith/              # Python application package
│   └── tests/              # Pytest integration tests
├── frontend/               # React + TypeScript + Tailwind UI
├── src-tauri/              # Tauri 2 Desktop Shell
├── voice_worker/           # Decoupled audio processing worker (Milestone 3)
└── docs/                   # Architectural blueprints and engineering guides
```

---

## 📜 Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Technology Stack](docs/TECH_STACK.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Security Policies](docs/SECURITY.md)
- [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)
