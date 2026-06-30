"""Builds the macro payload served at GET /api/macro.

Returns provenance-rich metrics + scheduled events. Scoring / regime / rationale
stay on the frontend engine (deterministic, already in src/lib/macro). This
layer only delivers transparent data.
"""
from __future__ import annotations

from datetime import datetime, timezone

from .registry import MacroRegistry
from .events import upcoming_events


def _freshness_seconds(ts: str | None, now: datetime) -> float | None:
    """Age of a data point in seconds (None if no timestamp)."""
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts)
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return round((now - dt).total_seconds())


def build_macro_payload(registry: MacroRegistry) -> dict:
    now = datetime.now(timezone.utc)
    quotes = registry.collect()
    metrics: dict[str, dict] = {}
    for key, q in quotes.items():
        d = q.to_dict()
        d["freshness"] = _freshness_seconds(q.timestamp, now)
        metrics[key] = d
    return {
        "generatedAt": now.isoformat(),
        "metrics": metrics,
        "events": upcoming_events(),
    }
