"""FastAPI gateway for the quant terminal.

    quant_engine (untouched)  ->  serializers  ->  FastAPI / WebSocket  ->  React

Endpoints:
  GET  /api/health              liveness
  GET  /api/snapshot            one full Snapshot (REST)
  WS   /ws/stream               continuous Snapshot stream (the live model)

Run from the repo root:
    pip install -r api/requirements.txt
    uvicorn api.server:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import math
import os
import sys
from pathlib import Path

# Ensure the repo root (which holds the quant_engine package) is importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from quant_engine.config import Config
from .serializers import build_snapshot, montecarlo
from .instrument import Probe, capture_exception, DEBUG

app = FastAPI(title="Quant Terminal API", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

STREAM_INTERVAL = float(os.getenv("QT_STREAM_INTERVAL", "2.0"))   # seconds
MC_EVERY = int(os.getenv("QT_MC_EVERY", "30"))                    # ticks per MC refresh


def _config() -> Config:
    cfg = Config.from_env()
    return cfg


def _clean(obj):
    """Replace NaN/Inf with None so the payload is strict-JSON valid."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    return obj


# Cache the (expensive) Monte-Carlo so the live stream stays smooth.
_MC_CACHE: dict | None = None


def _mc(cfg: Config, force: bool = False) -> dict:
    global _MC_CACHE
    if _MC_CACHE is None or force:
        try:
            _MC_CACHE = montecarlo(cfg)
        except Exception:
            _MC_CACHE = {}
    return _MC_CACHE


@app.get("/api/health")
def health():
    return {"ok": True}


def _log_error(payload: dict) -> None:
    """Persist the full traceback so a single live throw is never lost."""
    try:
        with open("qt_errors.log", "a") as fh:
            fh.write("\n" + "=" * 70 + "\n")
            fh.write(payload.get("traceback", ""))
            fh.write(f"failing_stage: {payload.get('failing_stage')}\n")
            fh.write(f"stage_inputs:  {payload.get('stage_inputs')}\n")
            fh.write(f"origin:        {payload.get('origin')}\n")
    except Exception:
        pass


@app.get("/api/snapshot")
def snapshot():
    cfg = _config()
    probe = Probe()
    try:
        mc = montecarlo(cfg, probe) if (_MC_CACHE is None) else _mc(cfg)
        snap = build_snapshot(cfg, mc, probe)
        return JSONResponse(_clean(snap))
    except Exception:
        payload = capture_exception("GET /api/snapshot", probe)
        _log_error(payload)
        # 500 with the COMPLETE traceback + the inputs at the failure point.
        return JSONResponse(payload, status_code=500)


@app.websocket("/ws/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    cfg = _config()
    tick = 0
    try:
        while True:
            probe = Probe()
            try:
                mc = _mc(cfg, force=(tick % MC_EVERY == 0))
                snap = await asyncio.to_thread(build_snapshot, cfg, mc, probe)
                await ws.send_json(_clean(snap))
            except (WebSocketDisconnect, asyncio.CancelledError):
                return
            except Exception:
                payload = capture_exception("WS /ws/stream", probe)
                _log_error(payload)
                # Surface the full traceback to the client too, then keep the
                # socket alive so the next tick can recover.
                await ws.send_json(_clean(payload))
            tick += 1
            await asyncio.sleep(STREAM_INTERVAL)
    except (WebSocketDisconnect, asyncio.CancelledError):
        return
