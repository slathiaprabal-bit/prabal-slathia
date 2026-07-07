"""OFFICIAL provider — now backed by the scheduled, cached Official Data system.

Repo, CPI, GDP, FII, DII and breadth each refresh on their own schedule via
real sources (NSE for flows; FRED when a key + series are set; seed bootstrap
otherwise), with a persistent last-good cache. This provider just maps the
scheduler's cached readings into MacroQuote — the contract the registry, route
and frontend already consume is unchanged, so badges (OFFICIAL/DELAYED/LIVE)
render exactly as before.
"""
from __future__ import annotations

from quant_engine.config import DATA_DIR

from ..base import MacroQuote, OFFICIAL, NO_LIVE_DATA
from ..official.scheduler import OfficialScheduler
from ..official.specs import SPECS
from ..official.sources import NseFlowsSource, FredSource


class OfficialProvider:
    name = "Official (scheduled)"

    def __init__(self):
        # Source priority: real auto-sources first, seed is the scheduler's
        # built-in bootstrap/fallback. Add Bloomberg/Refinitiv/Polygon/RBI here.
        self.scheduler = OfficialScheduler(
            specs=SPECS,
            sources=[NseFlowsSource(), FredSource(SPECS)],
            cache_path=DATA_DIR / "official_cache.json",
        )

    def fetch(self) -> dict[str, MacroQuote]:
        try:
            self.scheduler.tick()   # cheap: only fetches metrics that are due
        except Exception:
            pass
        out: dict[str, MacroQuote] = {}
        for key, r in self.scheduler.readings().items():
            has = r.value is not None
            out[key] = MacroQuote(
                key=key,
                value=r.value,
                previous=None,
                timestamp=r.release_date or r.last_updated,
                source=r.source,
                status=OFFICIAL if has else NO_LIVE_DATA,
                confidence=1.0 if has else 0.0,
                asof=r.release_date,
                next_release=r.next_release,
            )
        return out
