"""Composes providers into one metric map with last-good handling.

Disjoint providers (market keys vs official keys) are merged. If a market fetch
fails but we held a real prior value, we keep that value WITH its original
timestamp and mark it DELAYED — transparent staleness, never a silent refresh
and never a fabricated number. With no prior value the metric is NO_LIVE_DATA.
"""
from __future__ import annotations

from dataclasses import replace

from .base import MacroQuote, MacroProvider, DELAYED, OFFICIAL, NO_LIVE_DATA


class MacroRegistry:
    def __init__(self, providers: list[MacroProvider]):
        self.providers = providers
        self._last_good: dict[str, MacroQuote] = {}

    def collect(self) -> dict[str, MacroQuote]:
        merged: dict[str, MacroQuote] = {}
        for p in self.providers:
            try:
                quotes = p.fetch()
            except Exception:
                quotes = {}
            merged.update(quotes)

        out: dict[str, MacroQuote] = {}
        for key, q in merged.items():
            if q.value is not None:
                # Official figures are authoritative; market values are last-good.
                if q.status != OFFICIAL:
                    self._last_good[key] = q
                out[key] = q
            elif key in self._last_good:
                lg = self._last_good[key]
                # Keep the last real value + its timestamp, but flag it stale.
                out[key] = replace(lg, status=DELAYED,
                                   confidence=min(lg.confidence, 0.4))
            else:
                out[key] = replace(q, status=NO_LIVE_DATA, confidence=0.0)
        return out
