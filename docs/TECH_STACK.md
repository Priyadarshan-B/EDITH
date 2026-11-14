# EDITH – Technology Stack & Rationale

| Layer | Chosen Technology | Version / Target | Architectural Rationale |
|---|---|---|---|
| **Desktop Shell** | Tauri 2 | 2.0+ (Rust) | Minimal memory footprint (~40MB RAM vs >200MB in Electron), native Windows 11 integration, secure process sandboxing. |
| **Frontend UI** | React + TypeScript | React 18, TS 5.4+ | Component ecosystem, strict type contracts with backend schemas, rapid UI iteration. |
| **Styling & Theme** | Tailwind CSS | 3.4+ | Zero-runtime CSS, precise custom theme colors for futuristic Iron Man HUD aesthetic. |
| **Global State** | Zustand | 4.5+ | Lightweight, boilerplate-free state management for telemetry, voice states, and active chats. |
| **Backend Framework** | FastAPI + Uvicorn | FastAPI 0.111+, Uvicorn 0.30+ | High-throughput asynchronous REST & WebSockets, automatic OpenAPI docs, native Pydantic validation. |
| **ORM & Relational DB**| SQLAlchemy + SQLite | SQLAlchemy 2.0+ (AsyncIO) | Zero-maintenance local-first relational database with ACID guarantees, async query execution via `aiosqlite`. |
| **Hardware Adaptor** | Custom HardwareProfiler | Python psutil | Auto-detects CPU cores, available RAM, and CUDA VRAM to seamlessly switch between CPU int8 and GPU float16 modes. |
| **Local LLM Runtime** | Ollama | 0.3+ | Streamlined local model management, OpenAI-compatible streaming API, robust support for Qwen 2.5 and Llama 3.2. |
| **Speech-to-Text** | faster-whisper | CTranslate2 | Up to 4x faster than vanilla Whisper with int8 quantization on CPU. |
| **Text-to-Speech** | Piper TTS | ONNX Runtime | Ultra-fast offline voice synthesis (~15ms real-time factor on CPU). |
| **Wake-Word Detection**| openWakeWord | ONNX | Continuous low-power background inference (~1-2% CPU) on 80ms audio frames. |
| **Automation** | PyWin32 + PyAutoGUI | 306+ / 0.9.54+ | Native Windows window handling, keyboard/mouse automation, process management. |

