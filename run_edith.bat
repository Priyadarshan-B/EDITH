@echo off
title EDITH - Personal AI Operating Assistant
echo Launching EDITH Desktop & Neural Interface (console minimized)...
powershell.exe -WindowStyle Minimized -ExecutionPolicy Bypass -File "%~dp0run_edith.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo EDITH exited with error code %ERRORLEVEL%.
    pause
)
