# PyInstaller spec — VOLARA market engine (onedir).
#
# Build (from the repo root):
#   pyinstaller --clean --noconfirm desktop/engine.spec
# Output: dist/volara-engine/  → shipped by electron-builder as resources/engine.
#
# The frozen tree mirrors the source layout for quant_engine/data so the
# engine's package-relative DATA_DIR keeps working: seed market CSVs ship
# read-only next to the code; runtime cache writes are already fail-safe.

from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

ROOT = Path(SPECPATH).parent  # repo root (spec lives in desktop/)

# uvicorn/websockets pick protocol + loop implementations dynamically; pandas
# and yfinance are imported lazily inside engine functions — name them all.
hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("websockets")
    + [
        "yfinance",
        "requests",
        "pandas",
        "numpy",
    ]
)

datas = [
    (str(ROOT / "quant_engine" / "data" / name), "quant_engine/data")
    for name in ("nifty.csv", "vix.csv", "options.csv")
    if (ROOT / "quant_engine" / "data" / name).exists()
]

a = Analysis(
    ["engine-entry.py"],
    pathex=[str(ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=[
        # dashboard/dev-only heavyweights — never imported by api.server
        "streamlit",
        "matplotlib",
        "tkinter",
        "PyQt5",
        "PySide6",
        "IPython",
        "pytest",
        "notebook",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="volara-engine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # Electron spawns with windowsHide; console keeps stdio robust
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="volara-engine",
)
