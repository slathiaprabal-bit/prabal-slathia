"""Builds the /api/events payload.

Returns RAW events + provenance + lifecycle status + seconds-until. Deterministic
trading logic (impact rating, recommended action, week-risk score, live
countdown) is computed on the FRONTEND (Phase B), per the approved compute split.
Status is derived from the clock here so the badge is correct at fetch time; the
frontend still recomputes the live countdown every second.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .models import SCHEDULED, LIVE, COMPLETED
from .scheduler import EventScheduler

# How long an event is considered "LIVE" after its scheduled time, by category.
_LIVE_WINDOW_MIN = {
    "GLOBAL_MACRO": 90, "INDIA_MACRO": 120, "MARKET_STRUCTURE": 30, "CORPORATE": 60,
}


def _status(dt: datetime | None, now: datetime, category: str) -> str:
    if dt is None:
        return SCHEDULED
    if now < dt:
        return SCHEDULED
    window = timedelta(minutes=_LIVE_WINDOW_MIN.get(category, 90))
    if now <= dt + window:
        return LIVE
    return COMPLETED


def build_events_payload(scheduler: EventScheduler) -> dict:
    now = datetime.now(timezone.utc)
    events = []
    for r in scheduler.events():
        try:
            dt = datetime.fromisoformat(r.datetime)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            dt = None
        d = r.to_dict()
        d["status"] = _status(dt, now, r.category)
        d["secondsUntil"] = round((dt - now).total_seconds()) if dt else None
        events.append(d)
    return {"generatedAt": now.isoformat(), "events": events}
