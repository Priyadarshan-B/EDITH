# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Specification File for EDITH AI Assistant Backend Sidecar.
Compiles FastAPI, Uvicorn, SQLite, APScheduler, and core agent modules into a standalone executable.
"""

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

datas = [
    ('config', 'config'),
]
datas += collect_data_files('fastembed')
datas += collect_data_files('chromadb')

hiddenimports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'aiosqlite',
    'sqlalchemy.dialects.sqlite',
    'apscheduler.schedulers.asyncio',
    'apscheduler.triggers.date',
    'fastapi',
    'pydantic',
    'pydantic_settings',
    'pywin32',
    'pywintypes',
    'win32gui',
    'win32process',
    'psutil',
]
hiddenimports += collect_submodules('edith')

a = Analysis(
    ['backend/run_backend.py'],
    pathex=['backend', '.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'notebook', 'IPython'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='edith_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Headless background sidecar process
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='src-tauri/icons/icon.ico',
)
