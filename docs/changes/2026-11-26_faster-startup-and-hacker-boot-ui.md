# Faster Parallel Startup and Hacker-Effect "Initializing EDITH Core" Boot UI

## When
November 26, 2026 — After noticing `.\run_edith.ps1` took too long before any UI window appeared.

## Why
1. `run_edith.ps1` waited synchronously for the Python backend TCP port (up to 20 seconds) and performed a blocking `8.8.8.8` UDP socket check before even starting the Voice Worker or Tauri/Vite UI.
2. While services were starting, the user wanted an immediate cyber/hacker-style **"INITIALIZING E.D.I.T.H. CORE"** UI instead of waiting on a blank terminal.

## How it happened
- `run_edith.ps1` ran services sequentially (Backend wait loop → Voice Worker → Tauri/Vite) even though the frontend `BootLoader` already polls `/api/v1/system/boot-logs`.
- `App.tsx` gave up after one failed `/health` call (`1800ms`) instead of retrying while the backend booted in parallel.

## Solution
- **Parallel Launcher (`run_edith.ps1`)**:
  - Removed the 20-second blocking TCP wait loop so Backend, Voice Worker, and Tauri/Vite launch concurrently right away.
  - Replaced the `8.8.8.8` UDP probe with fast local `Get-NetIPAddress` lookup.
- **Hacker-Effect Boot UI (`frontend/src/components/hud/BootLoader.tsx`, `frontend/src/App.tsx`)**:
  - Upgraded `BootLoader.tsx` with a Matrix/hex rain canvas background, scanline overlay, `> INITIALIZING E.D.I.T.H. CORE` cyber header, live module status cards, and a `root@edith-core:~# tail -f data/boot.log` terminal stream with blinking cursor.
  - Updated `App.tsx` `initBackend()` to retry `/health` every 600ms while the backend finishes starting in parallel.
