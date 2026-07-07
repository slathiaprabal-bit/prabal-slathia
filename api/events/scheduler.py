"""EventScheduler — refreshes sources on a cadence into a persistent cache.

Sources emit a forward window of events; the scheduler merges them by id, stamps
provenance, and persists to disk. If ALL sources fail it keeps the last-good
event set (never drops the calendar, never fabricates). Recently-completed events
are retained briefly (archive window) so the future Historical Event Analytics
engine has data to attach to; older ones are pruned.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .models import EventRecord
from .sources.base import EventSource

_CHECK_INTERVAL_H = float(os.getenv("QT_EVENTS_CHECK_INTERVAL_H", "12"))
_ARCHIVE_DAYS = int(os.getenv("QT_EVENTS_ARCHIVE_DAYS", "14"))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


class EventScheduler:
    def __init__(self, sources: list[EventSource], cache_path: Path):
        self.sources = sources
        self.cache_path = Path(cache_path)
        self.cache: dict[str, EventRecord] = {}
        self.next_check: datetime | None = None
        self._load()

    # Bump when the event schema changes so a stale cache is discarded on load
    # rather than mixing old and new records (e.g. the per-instrument expiry
    # refactor superseding the old generic expiry events).
    CACHE_VERSION = 2

    # ── persistence ──
    def _load(self) -> None:
        try:
            if self.cache_path.exists():
                raw = json.loads(self.cache_path.read_text())
                if raw.get("version") != self.CACHE_VERSION:
                    self.cache = {}
                    return  # schema changed — start fresh, refetch on first tick
                self.cache = {k: EventRecord.from_dict(v) for k, v in raw.get("events", {}).items()}
                self.next_check = _parse(raw.get("next_check"))
        except Exception:
            self.cache = {}

    def _save(self) -> None:
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps({
                "version": self.CACHE_VERSION,
                "next_check": self.next_check.isoformat() if self.next_check else None,
                "events": {k: r.to_dict() for k, r in self.cache.items()},
            }, indent=2))
        except Exception:
            pass

    # ── scheduling ──
    def tick(self, force: bool = False) -> None:
        now = _now()
        if not force and self.next_check and now < self.next_check and self.cache:
            return
        collected: dict[str, EventRecord] = {}
        any_ok = False
        for src in self.sources:
            try:
                recs = src.fetch()
            except Exception:
                recs = None
            if recs is None:
                continue
            any_ok = True
            for r in recs:
                r.last_updated = now.isoformat()
                r.last_checked = now.isoformat()
                collected[r.id] = r
        if any_ok:
            # Merge fresh forward events over the cache; keep recently-completed
            # ones inside the archive window, prune older.
            self.cache.update(collected)
            cutoff = now - timedelta(days=_ARCHIVE_DAYS)
            self.cache = {
                k: r for k, r in self.cache.items()
                if (_parse(r.datetime) or now) >= cutoff
            }
        # else: all sources failed -> keep last-good cache untouched
        self.next_check = now + timedelta(hours=_CHECK_INTERVAL_H)
        self._save()

    def events(self) -> list[EventRecord]:
        return sorted(self.cache.values(), key=lambda r: r.datetime or "")
