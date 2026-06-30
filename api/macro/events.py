"""Scheduled macro events (extensibility seam for Economic Calendar / RBI
Tracker / FOMC & US-CPI countdowns). These are OFFICIAL, publicly-scheduled
dates — not fabricated. Maintain alongside api/macro/official/specs.py.
"""
from __future__ import annotations

from datetime import datetime, timezone

# name, ISO datetime (with tz), type, importance, source.
SCHEDULED_EVENTS: list[dict] = [
    {"name": "India CPI (Jun)", "datetime": "2026-07-13T17:30:00+05:30",
     "type": "IN_CPI", "importance": "medium", "source": "MOSPI"},
    {"name": "US CPI (Jun)", "datetime": "2026-07-15T08:30:00-04:00",
     "type": "US_CPI", "importance": "high", "source": "US BLS"},
    {"name": "FOMC Decision", "datetime": "2026-07-29T14:00:00-04:00",
     "type": "FOMC", "importance": "high", "source": "US Federal Reserve"},
    {"name": "RBI MPC Decision", "datetime": "2026-08-06T10:00:00+05:30",
     "type": "RBI", "importance": "high", "source": "RBI"},
]


def upcoming_events(limit: int = 8) -> list[dict]:
    """Future events sorted by time, each with seconds-until for countdowns."""
    now = datetime.now(timezone.utc)
    out = []
    for ev in SCHEDULED_EVENTS:
        try:
            dt = datetime.fromisoformat(ev["datetime"])
        except Exception:
            continue
        secs = (dt - now).total_seconds()
        if secs < 0:
            continue
        out.append({**ev, "secondsUntil": round(secs)})
    out.sort(key=lambda e: e["secondsUntil"])
    return out[:limit]
