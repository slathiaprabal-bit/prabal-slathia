"""PyInstaller entry point for the VOLARA market engine.

Runs the untouched FastAPI app (api.server) under uvicorn, exactly as the dev
command `python -m uvicorn api.server:app` does — programmatic startup only,
because frozen apps have no reliable `-m` machinery.

No engine/back-end code is modified: this file is packaging glue.
"""

import io
import multiprocessing
import os
import sys


def _guard_std_streams() -> None:
    """Frozen windowed processes may have no stdout/stderr; uvicorn's logging
    writes on startup would then crash. Give it a sink so the engine behaves
    the same whether spawned by Electron (pipes) or launched directly."""
    if sys.stdout is None:
        sys.stdout = io.TextIOWrapper(open(os.devnull, "wb"), encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = io.TextIOWrapper(open(os.devnull, "wb"), encoding="utf-8")


def main() -> None:
    multiprocessing.freeze_support()  # required before anything else on Windows
    _guard_std_streams()

    import uvicorn
    from api.server import app  # noqa: WPS433 — after freeze_support by design

    uvicorn.run(
        app,
        host=os.getenv("VOLARA_ENGINE_HOST", "127.0.0.1"),
        port=int(os.getenv("VOLARA_ENGINE_PORT", "8000")),
        log_level="warning",
    )


if __name__ == "__main__":
    main()
