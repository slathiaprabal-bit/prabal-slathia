"""StaticScheduleSource — emits the official published-calendar catalog.

This is the bootstrap source: it turns api/events/catalog.py (operator-maintained
official dates) into EventRecords. A live calendar API replaces this one class.
"""
from __future__ import annotations

from ..models import EventRecord
from ..catalog import CATALOG


class StaticScheduleSource:
    name = "Official published calendars"

    def fetch(self) -> list[EventRecord] | None:
        out: list[EventRecord] = []
        for e in CATALOG:
            try:
                day = e["datetime"][:10]
                out.append(EventRecord(
                    id=f"{e['type']}:{day}",
                    type=e["type"], name=e["name"], category=e["category"],
                    country=e["country"], datetime=e["datetime"],
                    importance=e["importance"], expected_vol=e.get("expected_vol", "NEUTRAL"),
                    vol_magnitude=float(e.get("vol_magnitude", 0.0)),
                    markets=list(e.get("markets") or []),
                    sectors=list(e.get("sectors") or []),
                    description=e.get("description", ""),
                    source=e.get("source", self.name), source_url=e.get("source_url"),
                ))
            except Exception:
                continue  # skip a malformed entry; never fabricate
        return out
