# EDITH Startup Launcher (PowerShell)
# Launches Backend, Voice Worker, and Frontend HUD concurrently

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      E.D.I.T.H. - Even Dead, I'm The Hero" -ForegroundColor Cyan
Write-Host "  Personal AI Desktop Assistant | Local-First Engine" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ROOT_DIR = $PSScriptRoot
$VENV_PYTHON = Join-Path $ROOT_DIR ".venv\Scripts\python.exe"

if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host "Error: Virtual environment python not found at $VENV_PYTHON" -ForegroundColor Red
    exit 1
}

# 1. Start Python Backend
Write-Host "`n[1/3] Starting EDITH AI Core Backend on port 18420..." -ForegroundColor Green
$backendProc = Start-Process -FilePath $VENV_PYTHON -ArgumentList "backend/run_backend.py" -WorkingDirectory $ROOT_DIR -PassThru -NoNewWindow

Start-Sleep -Seconds 2

# 2. Start Voice Worker (isolated process)
Write-Host "[2/3] Starting Voice Engine Worker..." -ForegroundColor Green
$voiceProc = Start-Process -FilePath $VENV_PYTHON -ArgumentList "voice_worker/run_worker.py" -WorkingDirectory $ROOT_DIR -PassThru -NoNewWindow

# 3. Launch Frontend HUD
Write-Host "[3/3] Launching EDITH Frontend HUD..." -ForegroundColor Green
Set-Location -Path (Join-Path $ROOT_DIR "frontend")
npm run dev

# Cleanup when user stops frontend
Write-Host "`nShutting down EDITH processes..." -ForegroundColor Yellow
if ($backendProc -and -not $backendProc.HasExited) {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
}
if ($voiceProc -and -not $voiceProc.HasExited) {
    Stop-Process -Id $voiceProc.Id -Force -ErrorAction SilentlyContinue
}
Write-Host "[OK] EDITH services stopped cleanly." -ForegroundColor Cyan
