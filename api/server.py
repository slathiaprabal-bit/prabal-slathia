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
from .macro.router import macro_router, start_macro_refresher
from .events.router import events_router, start_events_refresher
from .marketstructure.router import market_structure_router

app = FastAPI(title="Quant Terminal API", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
# Isolated, additive Macro Intelligence subsystem (GET /api/macro). Does not
# touch the quant engine, the snapshot, or the live-market WebSocket.
app.include_router(macro_router)
# Isolated, additive Market Event Intelligence subsystem (GET /api/events).
app.include_router(events_router)
# Single source of truth for index-options expiries (GET /api/market-structure).
app.include_router(market_structure_router)


@app.on_event("startup")
async def _start_macro():
    start_macro_refresher()


@app.on_event("startup")
async def _start_events():
    start_events_refresher()

STREAM_INTERVAL = float(os.getenv("QT_STREAM_INTERVAL", "2.0"))   # seconds
MC_EVERY = int(os.getenv("QT_MC_EVERY", "30"))                    # ticks per MC refresh
SECONDARY_REFRESH = float(os.getenv("QT_SECONDARY_REFRESH", "5.0"))  # seconds


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


@app.on_event("startup")
async def _start_secondary_refresher():
    """Refresh the secondary-index quotes on their own cadence.

    The BankNifty/Sensex/FinNifty fetch is 3 sequential yfinance calls — too
    slow to run inside every 2s snapshot tick. Running it here, off the tick
    loop, keeps `serializers._SEC_CACHE` warm so the per-tick read never blocks,
    and all four indices update at ~SECONDARY_REFRESH (not once per 30 ticks).
    """
    from quant_engine.data import get_secondary_indices
    from .serializers import _SEC_CACHE

    cfg = _config()

    async def loop():
        while True:
            try:
                # Fetch all symbols and assemble the full strip off-thread, then
                # publish with a single atomic assignment — readers (the snapshot
                # builder) only ever see a complete strip, never a partial one.
                fresh = await asyncio.to_thread(get_secondary_indices, cfg)
                if fresh:
                    _SEC_CACHE["data"] = fresh
            except Exception:
                pass
            await asyncio.sleep(SECONDARY_REFRESH)

    asyncio.create_task(loop())


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/vol/instruments")
def vol_instruments():
    """Registered indices for the terminal's instrument selector."""
    from .volcontext import instruments
    return JSONResponse(instruments())


@app.get("/api/vol/{instrument}")
def vol_context(instrument: str):
    """Full multi-asset vol context (spot, surface, history…) for one index."""
    from .volcontext import get_context
    ctx = get_context(instrument)
    if ctx is None:
        return JSONResponse({"error": f"unknown instrument {instrument}"}, status_code=404)
    return JSONResponse(_clean(ctx))


@app.get("/api/vol-replay/{instrument}")
def vol_replay(instrument: str):
    """Intraday volatility replay samples for one instrument, current session."""
    from .volreplay import session
    return JSONResponse(_clean(session(instrument.upper())))


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
