param(
    [switch]$Web,
    [switch]$Release,
    [switch]$NoReload
)

# EDITH One-Click Launcher (PowerShell)
# Launches Backend (with Hot Reload), Voice Worker, Tauri Desktop App (with Vite HMR),
# and exposes Mobile PWA/Hot-Reload URL on your local Wi-Fi.

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      E.D.I.T.H. - Even Dead, I'm The Hero" -ForegroundColor Cyan
Write-Host "  Desktop + Mobile One-Click Launcher | Hot Reload Enabled" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $env:EDITH_USER_NAME) {
    $env:EDITH_USER_NAME = "Boss"
}
if (-not $env:EDITH_USER_TITLE) {
    $env:EDITH_USER_TITLE = "Boss"
}
Write-Host "Operator Active: $env:EDITH_USER_NAME ($env:EDITH_USER_TITLE)" -ForegroundColor Yellow

$ROOT_DIR = $PSScriptRoot
$VENV_PYTHON = Join-Path $ROOT_DIR ".venv\Scripts\python.exe"
$BACKEND_PORT = 18425
$BOOT_LOG = Join-Path $ROOT_DIR "data\boot.log"

New-Item -ItemType Directory -Force -Path (Join-Path $ROOT_DIR "data") | Out-Null
$ts = Get-Date -Format "HH:mm:ss"
"$ts | INFO    | launcher - Operator Active: $env:EDITH_USER_NAME ($env:EDITH_USER_TITLE)" | Out-File -FilePath $BOOT_LOG -Encoding utf8
"$ts | INFO    | launcher - Initializing EDITH AI Core Backend on port $BACKEND_PORT..." | Add-Content -Path $BOOT_LOG -Encoding utf8

if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host "Error: Virtual environment python not found at $VENV_PYTHON" -ForegroundColor Red
    exit 1
}

# Clean up any stale process on backend port 18425 or Vite port 1420
foreach ($pnum in @($BACKEND_PORT, 1420)) {
    $staleConns = Get-NetTCPConnection -LocalPort $pnum -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $staleConns) {
        if ($conn.OwningProcess -gt 0) {
            Write-Host "Cleaning up stale process (PID $($conn.OwningProcess)) on port $pnum..." -ForegroundColor DarkYellow
            taskkill /T /F /PID $conn.OwningProcess 2>$null | Out-Null
        }
    }
}

# Detect PC LAN IP for one-click Mobile PWA / Capacitor access (fast, non-blocking)
$lanIp = "127.0.0.1"
try {
    $ipObj = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and $_.IPAddress -notmatch '^169\.254\.' -and $_.IPAddress -ne '127.0.0.1' } |
        Select-Object -First 1
    if ($ipObj) { $lanIp = $ipObj.IPAddress }
} catch { }

# Enable hot-reload on Python backend by default (pass -NoReload to disable)
$env:EDITH_PORT = "$BACKEND_PORT"
$env:EDITH_RELOAD = if ($NoReload -or $Release) { "false" } else { "true" }

# 1. Start Python Backend + Voice Worker immediately in parallel (UI BootLoader tracks readiness live)
Write-Host "`n[1/3] Launching EDITH AI Core Backend on port $BACKEND_PORT (Hot Reload: $env:EDITH_RELOAD)..." -ForegroundColor Green
$backendProc = Start-Process -FilePath $VENV_PYTHON -ArgumentList "backend/run_backend.py" -WorkingDirectory $ROOT_DIR -PassThru -NoNewWindow

# 2. Start Voice Worker in parallel (isolated process)
Write-Host "[2/3] Launching Voice Engine Worker in parallel..." -ForegroundColor Green
"$(Get-Date -Format 'HH:mm:ss') | INFO    | launcher - Launching Backend + Voice Engine Worker in parallel..." | Add-Content -Path $BOOT_LOG -Encoding utf8
$voiceProc = Start-Process -FilePath $VENV_PYTHON -ArgumentList "voice_worker/run_worker.py" -WorkingDirectory $ROOT_DIR -PassThru -NoNewWindow

# Print Mobile App (PWA + Hot Reload) connection URLs
Write-Host "`n[Mobile App / PWA Access on Wi-Fi]" -ForegroundColor Magenta
Write-Host "  Hot-Reload Mobile UI : http://${lanIp}:1420" -ForegroundColor White
Write-Host "  Backend API / Standalone PWA : http://${lanIp}:$BACKEND_PORT" -ForegroundColor White

# 3. Launch Native Desktop App (Tauri with Vite HMR) or Web Mode (-Web)
$mingwBin = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\BrechtSanders.WinLibs*\mingw64\bin" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$env:Path = "$env:USERPROFILE\.cargo\bin;" + ($(if ($mingwBin) { "$mingwBin;" } else { "" })) + $env:Path
$releaseExe = Join-Path $ROOT_DIR "src-tauri\target\release\edith-desktop.exe"

try {
    if ($Web) {
        Write-Host "`n[3/3] Launching EDITH Web + Mobile Hot-Reload Server at http://127.0.0.1:1420..." -ForegroundColor Green
        Set-Location -Path (Join-Path $ROOT_DIR "frontend")
        npx vite --host 0.0.0.0 --port 1420 --open
    } elseif ($Release -and (Test-Path $releaseExe)) {
        Write-Host "`n[3/3] Launching EDITH Native Desktop Application (Release)..." -ForegroundColor Green
        Start-Process -FilePath $releaseExe -WorkingDirectory $ROOT_DIR -Wait
    } else {
        Write-Host "`n[3/3] Launching EDITH Native Desktop App (Tauri + Vite Hot Reload)..." -ForegroundColor Green
        Set-Location -Path $ROOT_DIR
        & (Join-Path $ROOT_DIR "frontend\node_modules\.bin\tauri.cmd") dev
    }
} finally {
    Write-Host "`nShutting down EDITH background processes..." -ForegroundColor Yellow
    if ($backendProc -and -not $backendProc.HasExited) {
        taskkill /T /F /PID $backendProc.Id 2>$null | Out-Null
    }
    if ($voiceProc -and -not $voiceProc.HasExited) {
        taskkill /T /F /PID $voiceProc.Id 2>$null | Out-Null
    }
    # Ensure any uvicorn reloader child listening on backend port is also cleaned up
    $leftover = Get-NetTCPConnection -LocalPort $BACKEND_PORT -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $leftover) {
        if ($conn.OwningProcess -gt 0) {
            taskkill /T /F /PID $conn.OwningProcess 2>$null | Out-Null
        }
    }
    Write-Host "[OK] EDITH services stopped cleanly." -ForegroundColor Cyan
}
