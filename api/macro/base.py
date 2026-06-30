"""Macro provider abstraction + the metric data contract.

Swapping yfinance for an institutional feed (Polygon, Financial Modeling Prep,
Alpha Vantage, Refinitiv, Bloomberg, or a broker API) is a SINGLE new provider
file implementing `MacroProvider.fetch()`. The registry, service, route,
scoring engine and UI never change — they only consume `MacroQuote`s.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Protocol, runtime_checkable

# ── Status vocabulary the UI understands (single source of truth) ──
LIVE = "LIVE"                 # real-time, fresh
DELAYED = "DELAYED"           # real source but lagged (e.g. EOD / 15-min)
OFFICIAL = "OFFICIAL"         # authoritative slow print, dated
MARKET_CLOSED = "MARKET_CLOSED"  # last close shown, market shut
NO_LIVE_DATA = "NO_LIVE_DATA"    # fetch failed and no last-good -> never fabricate


@dataclass
class MacroQuote:
    """One macro metric with full provenance. value is None when unknown."""
    key: str
    value: float | None = None
    previous: float | None = None
    timestamp: str | None = None        # ISO8601 of the underlying data point
    source: str = ""                    # human label, e.g. "Yahoo Finance", "RBI"
    status: str = NO_LIVE_DATA
    confidence: float = 0.0             # 0..1 (source reliability × freshness)
    asof: str | None = None             # official: release date (ISO)
    next_release: str | None = None     # official: next scheduled release (ISO)

    def to_dict(self) -> dict:
        return asdict(self)


@runtime_checkable
class MacroProvider(Protocol):
    """A source of macro metrics. Must never raise to the caller and must never
    fabricate values — return MacroQuote(status=NO_LIVE_DATA) on failure."""
    name: str

    def fetch(self) -> dict[str, "MacroQuote"]:
        ...
