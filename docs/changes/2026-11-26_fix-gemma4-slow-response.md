# Fix Slow Responses on `gemma4:e2b` and Normal Conversational Questions

## When
November 26, 2026 — After testing a normal chat question (`"Hey EDITH, how are you and what can you help me with?"`) and seeing `gemma4:e2b` stall for over 1 minute at 100% CPU / 13.8 GB RAM.

## Why
Normal conversational questions were taking 60+ seconds (or timing out) on local `gemma4:e2b` instead of streaming back in a few seconds.

## How it happened
Three bottlenecks stacked together:
1. **Unnecessary blocking MCP router call**: Before streaming any response, `plan_mcp_action()` in `backend/edith/core/orchestrator.py` only skipped exact single-word greetings (`"hi"`, `"hello"`). Any normal sentence like `"Hey EDITH, how are you..."` triggered a full blocking LLM call with the entire MCP tools catalog JSON before the real chat response even began.
2. **Thinking mode + uncapped context in Ollama**: `OllamaProvider` in `backend/edith/providers/ollama.py` did not pass `"think": false` for reasoning-capable models (`gemma4`, `qwen3`, `deepseek-r1`, `qwq`) and did not cap `num_ctx` or set `keep_alive`. On CPU with ~14 GB RAM used, Gemma 4 spent 30–60+ seconds generating hidden thinking tokens and allocating a huge context cache before emitting any visible text.
3. **`"edith"` keyword trapping general chat locally**: `is_non_desktop_or_news_query()` in `backend/edith/providers/manager.py` treated `"edith"` as a desktop-only keyword, preventing general conversational questions addressed to EDITH from using fast cloud providers when available.

## Solution
- **Fast MCP pre-filter (`backend/edith/core/orchestrator.py`)**: Skipped the blocking MCP router LLM call for conversational greetings/chitchat and prompts that don't mention any MCP/tool/search/external-action keywords.
- **Snappy Ollama streaming (`backend/edith/providers/ollama.py`)**: Added `"num_ctx": settings.models.local.context_window`, `"keep_alive": "15m"`, and `"think": False` for thinking-capable models (`gemma4`, `qwen3`, `deepseek-r1`, `qwq`) so tokens stream immediately with low RAM overhead.
- **Smart cloud/local routing (`backend/edith/providers/manager.py`)**: Removed `"edith"` from `desktop_or_personal_keywords` so general questions addressed to EDITH can route to fast cloud models when configured, while staying fast locally when offline.
