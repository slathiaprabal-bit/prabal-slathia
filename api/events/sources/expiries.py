"""ExpirySource — emits per-instrument index-options expiries as EventRecords.

All expiry logic comes from the Market Structure Provider (the single source of
truth). This source only maps Expiry -> EventRecord; it computes no dates and
holds no weekday rules.
"""
from __future__ import annotations

from ..models import EventRecord
from ...marketstructure.provider import MarketStructureProvider


class ExpirySource:
    name = "NSE/BSE Market Structure Provider"

    def __init__(self):
        self._ms = MarketStructureProvider()

    def fetch(self) -> list[EventRecord] | None:
        out: list[EventRecord] = []
        for e in self._ms.all_expiries(within_days=60):
            kind = e.kind                         # WEEKLY | MONTHLY
            etype = f"EXPIRY_{kind}_{e.instrument}"   # stable per (instrument, kind)
            importance = "HIGH" if kind == "MONTHLY" else "MEDIUM"
            magnitude = 0.55 if kind == "MONTHLY" else 0.3
            adj = (f" (moved from {e.original_date} — exchange holiday)"
                   if e.adjusted else "")
            out.append(EventRecord(
                id=f"{etype}:{e.date}",
                type=etype,
                name=f"{e.instrument} {kind.title()} Expiry",
                category="MARKET_STRUCTURE", country="IN",
                datetime=e.datetime,
                importance=importance, expected_vol="CONTRACTION", vol_magnitude=magnitude,
                markets=[e.instrument], sectors=[],
                description=(f"{e.exchange} {e.instrument} {kind.lower()} options expiry at "
                             f"15:30 IST — accelerated theta with ATM gamma/pin risk into the close.{adj}"),
                source=f"{e.exchange} · Market Structure Provider",
                source_url="https://www.nseindia.com/products-services/equity-derivatives-expiry-calendar",
            ))
        return out
