# Switch Local Routing Model to Gemma 4 (`gemma4:e2b`), Natasha Default Voice, and Human Spoken Summaries

## When
November 26, 2026 — After switching the lightweight local model from `qwen2.5:3b` to `gemma4:e2b` and upgrading voice defaults and speech delivery.

## Why
1. `qwen2.5:3b` needed to be replaced with Ollama's `gemma4:e2b` for faster edge performance, native tool calling, and a larger context window, while keeping `qwen2.5:7b` for heavier CUDA-capable systems.
2. Previously, `ModelManager` did not auto-pick the best local model based on the computer's hardware + pulled Ollama models, and any model name containing `"gemma"` was mistakenly routed to Gemini cloud instead of local Ollama.
3. Changing to other local models in the future required editing hardcoded `qwen2.5:3b` references in multiple files and didn't list newly pulled Ollama models in the UI.
4. The default voice needed to be Natasha (`en-AU-NatashaNeural`), saved across restarts, and spoken responses needed to be summarized into friendly human speech (using `Boss`, `Sir`, and `Priyan`) instead of reading full text verbatim — while still saving the full response in SQLite and keeping the continuous learning pipeline unchanged.

## How it happened
- `qwen2.5:3b` was hardcoded across backend config, `HardwareProfiler`, `OllamaProvider`, `learner.py` (`Modelfile.edith`), frontend stores, and tests.
- `ModelManager._infer_provider_type()` matched `"gemma"` to `"gemini"` cloud, and `ModelSelector.tsx` only displayed a fixed list of suggested local models while passing `"gemini"` for all cloud clicks.
- Voice settings in `voice.py` were only kept in memory (lost on backend restart), and `speakText` in `speech.ts` only trimmed/truncated text locally instead of summarizing full replies into natural spoken human sentences.

## Solution
- **Local LLM & Future Model Support**:
  - Updated `routing_model` to `gemma4:e2b` (keeping `complex_model` as `qwen2.5:7b`) in `config/default_config.yaml`, `backend/edith/config.py`, `frontend/src/stores/chatStore.ts`, and `frontend/src/stores/systemStore.ts`.
  - Updated `HardwareProfiler.detect_capabilities()` in `backend/edith/providers/hardware.py` to read `routing_model` and `complex_model` from config dynamically.
  - Updated `ModelManager` in `backend/edith/providers/manager.py` and `backend/edith/server.py` so EDITH auto-selects the best installed local Ollama model for the detected hardware on startup, routes any Ollama `name:tag` (including `gemma4:e2b` and future models) to `"ollama"`, and lists all pulled Ollama models in the UI dropdown (`frontend/src/components/hud/ModelSelector.tsx`), also fixing cloud provider selection to use `m.provider`.
  - Updated `backend/edith/api/v1/health.py` and `frontend/src/App.tsx` + `frontend/src/types/index.ts` so the active hardware-selected model is synced on startup.
  - Updated `backend/edith/providers/ollama.py` to default to configured `routing_model` and reference `self.model_name` dynamically.
  - Updated `backend/edith/memory/learner.py` so `Modelfile.edith` uses the active/configured local model (`FROM ...`) instead of hardcoded `qwen2.5:3b`, while keeping the continuous learning dataset and workflow identical.
- **Friendly Human Tone (`Boss`, `Sir`, `Priyan`)**:
  - Updated `backend/edith/api/v1/chat.py` and `backend/edith/memory/learner.py` prompts so EDITH speaks warmly and naturally using `Boss`, `Sir`, and `Priyan` (or configured user name/title).
- **Default Natasha Voice, Persistence, and Spoken Summaries**:
  - Set `en-AU-NatashaNeural` (`Natasha (AU)`) as the default voice in `backend/edith/api/v1/voice.py`, `frontend/src/stores/voiceStore.ts`, and `frontend/src/utils/speech.ts`.
  - Added disk persistence (`data/voice_settings.json`) in `backend/edith/api/v1/voice.py` and startup sync (`syncFromBackend`) in `frontend/src/stores/voiceStore.ts` and `frontend/src/App.tsx` so voice and speed changes stay saved.
  - Added `POST /api/v1/voice/summarize` (`backend/edith/api/v1/voice.py`), `api.summarizeForSpeech()` (`frontend/src/api/client.ts`), and integrated it into `speakText()` (`frontend/src/utils/speech.ts`) so full assistant replies are saved in the database and learning logs as-is, while spoken playback is summarized by the LLM into 1–2 warm, clear human sentences (with `{ summarize: false }` for short UI phrases in `App.tsx`, `SystemTab.tsx`, and `MainHUD.tsx`).
- **Tests**:
  - Updated `backend/tests/test_server_and_system.py` and `backend/tests/test_chat_and_models.py` to cover `gemma4:e2b`, future local model provider routing, Natasha voice defaults/persistence, and `/api/v1/voice/summarize`.
