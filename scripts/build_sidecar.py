"""
Automated Build & Sidecar Packaging Script for EDITH.
Prepares the standalone backend executable and places it in src-tauri/binaries/
formatted for Tauri 2 multi-target bundling.
"""

import sys
import shutil
import subprocess
from pathlib import Path

TARGET_TRIPLE = "x86_64-pc-windows-msvc"
TAURI_BIN_DIR = Path("src-tauri/binaries")
SPEC_FILE = Path("scripts/edith_backend.spec")


def build_sidecar():
    print(f"\n==========================================")
    print(f"  Building EDITH Backend Sidecar Binary   ")
    print(f"  Target: {TARGET_TRIPLE}                 ")
    print(f"==========================================\n")

    TAURI_BIN_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Execute PyInstaller
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        str(SPEC_FILE),
    ]

    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd)

    if result.returncode != 0:
        print(f"❌ PyInstaller build failed with exit code {result.returncode}")
        sys.exit(result.returncode)

    # 2. Locate built executable
    built_exe = Path("dist/edith_backend.exe")
    if not built_exe.exists():
        print(f"❌ Built executable not found at {built_exe}")
        sys.exit(1)

    # 3. Copy to Tauri binaries directory with target triple suffix
    dest_exe = TAURI_BIN_DIR / f"edith_backend-{TARGET_TRIPLE}.exe"
    shutil.copy2(built_exe, dest_exe)

    print(f"\n✓ Successfully packaged and deployed sidecar to:")
    print(f"  --> {dest_exe.resolve()} ({dest_exe.stat().st_size / (1024*1024):.2f} MB)")
    print(f"✓ Tauri 2 build can now bundle this binary natively.\n")


if __name__ == "__main__":
    build_sidecar()
