"""OfficialScheduler — per-indicator scheduled refresh with a persistent,
provenance-rich cache.

Behaviour per `tick()` (called cheaply on the macro refresh cadence):
  * unknown metric          -> bootstrap from the seed (status OFFICIAL)
  * not yet due             -> leave cached value untouched
  * due + a source returns  -> update value + timestamps + next_release
  * due + all sources fail  -> KEEP the previous value & its timestamp, only
                               bump last_checked/next_check (transparent staleness)

The cache is persisted to disk so values survive restarts and sources are never
re-hit more often than their schedule. Nothing is ever fabricated.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .models import OfficialSpec, OfficialReading
from .sources import OfficialSource, SeedSource

OFFICIAL = "OFFICIAL"
NO_LIVE_DATA = "NO_LIVE_DATA"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso)
    except Exception:
        return None


class OfficialScheduler:
    def __init__(self, specs: list[OfficialSpec], sources: list[OfficialSource],
                 cache_path: Path):
        self.specs = specs
        self.sources = sources          # real sources, priority order (no seed)
        self.seed = SeedSource(specs)   # bootstrap / last-resort
        self.cache_path = Path(cache_path)
        self.cache: dict[str, OfficialReading] = self._load()

    # ── persistence ──────────────────────────────────────────────────────
    def _load(self) -> dict[str, OfficialReading]:
        try:
            if self.cache_path.exists():
                raw = json.loads(self.cache_path.read_text())
                return {k: OfficialReading.from_dict(v) for k, v in raw.items()}
        except Exception:
            pass
        return {}

    def _save(self) -> None:
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps(
                {k: r.to_dict() for k, r in self.cache.items()}, indent=2))
        except Exception:
            pass

    # ── scheduling ───────────────────────────────────────────────────────
    def tick(self) -> None:
        now = _now()
        changed = False
        for spec in self.specs:
            r = self.cache.get(spec.key)
            if r is None:
                self.cache[spec.key] = self._bootstrap(spec, now)
                changed = True
                continue
            nxt = _parse(r.next_check)
            if nxt is not None and now < nxt:
                continue  # not due yet
            self.cache[spec.key] = self._refresh(spec, r, now)
            changed = True
        if changed:
            self._save()

    def _bootstrap(self, spec: OfficialSpec, now: datetime) -> OfficialReading:
        sr = self.seed.fetch(spec.key)
        if sr is None:
            return OfficialReading(spec.key, None, spec.source_label, None,
                                   spec.next_release, None, _iso(now),
                                   _iso(now + timedelta(hours=spec.check_interval_h)),
                                   NO_LIVE_DATA)
        # Bootstrapped from seed; due immediately so a real source can take over.
        return OfficialReading(spec.key, sr.value, sr.source, sr.release_date,
                               spec.next_release, _iso(now), _iso(now), _iso(now),
                               OFFICIAL)

    def _refresh(self, spec: OfficialSpec, prev: OfficialReading,
                 now: datetime) -> OfficialReading:
        got = None
        for src in self.sources:
            try:
                got = src.fetch(spec.key)
            except Exception:
                got = None
            if got is not None:
                break
        next_check = _iso(now + timedelta(hours=spec.check_interval_h))
        if got is not None:
            return OfficialReading(spec.key, got.value, got.source,
                                   got.release_date or prev.release_date,
                                   spec.next_release, _iso(now), _iso(now),
                                   next_check, OFFICIAL)
        # Source unreachable -> keep the previous official value + its timestamp.
        prev.last_checked = _iso(now)
        prev.next_check = next_check
        prev.next_release = spec.next_release
        return prev

    def readings(self) -> dict[str, OfficialReading]:
        return dict(self.cache)
