"""Additive FastAPI surface for the macro subsystem.

Exposes GET /api/macro, served from a background-refreshed cache so requests
never block on yfinance. Wired into the app from api/server.py via
`app.include_router(macro_router)` + `start_macro_refresher()`. Touches no
existing route, the snapshot, or the live-market WebSocket.
"""
from __future__ import annotations

import asyncio
import os

from fastapi import APIRouter

from .registry import MacroRegistry
from .service import build_macro_payload
from .providers.yfinance_market import YFinanceMarketProvider
from .providers.official import OfficialProvider

MACRO_REFRESH = float(os.getenv("QT_MACRO_REFRESH", "60"))  # seconds

# Provider order is the swap point: replace YFinanceMarketProvider with an
# institutional feed here (or via env) and nothing else in VOLARA changes.
_registry = MacroRegistry([YFinanceMarketProvider(), OfficialProvider()])
_macro_cache: dict = {"data": None}

macro_router = APIRouter()


@macro_router.get("/api/macro")
def get_macro():
    data = _macro_cache["data"]
    if data is None:
        # Cold start before the refresher's first pass — seed synchronously.
        data = build_macro_payload(_registry)
        _macro_cache["data"] = data
    return data


def start_macro_refresher() -> None:
    """Launch the background refresher (call once, from app startup)."""
    async def loop():
        while True:
            try:
                data = await asyncio.to_thread(build_macro_payload, _registry)
                _macro_cache["data"] = data
            except Exception:
                pass
            await asyncio.sleep(MACRO_REFRESH)

    asyncio.create_task(loop())
