"""Additive FastAPI surface for Market Event Intelligence.

Exposes GET /api/events from a scheduler-backed cache. Source refreshes run on a
background loop; status/countdown are computed fresh on each request (cheap), so
the badge is always current. Wired from api/server.py via include_router +
start_events_refresher. Touches no existing route, the snapshot, the macro
module, or the live-market WebSocket.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import APIRouter

from quant_engine.config import DATA_DIR

from .scheduler import EventScheduler
from .service import build_events_payload
from .sources.static_schedule import StaticScheduleSource
from .sources.expiries import ExpirySource

EVENTS_REFRESH = float(os.getenv("QT_EVENTS_REFRESH", "1800"))  # seconds (30 min)

# Source order is the swap point: add a live calendar / paid provider here and
# nothing else in VOLARA changes.
_scheduler = EventScheduler(
    sources=[StaticScheduleSource(), ExpirySource()],
    cache_path=Path(DATA_DIR) / "events_cache.json",
)

events_router = APIRouter()


@events_router.get("/api/events")
def get_events():
    if not _scheduler.cache:
        _scheduler.tick(force=True)  # cold-start seed
    return build_events_payload(_scheduler)


def start_events_refresher() -> None:
    async def loop():
        while True:
            try:
                await asyncio.to_thread(_scheduler.tick)
            except Exception:
                pass
            await asyncio.sleep(EVENTS_REFRESH)

    asyncio.create_task(loop())
