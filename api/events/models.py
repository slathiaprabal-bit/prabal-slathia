"""Data contract for Market Event Intelligence."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict

# ── Categories ──
INDIA_MACRO = "INDIA_MACRO"
GLOBAL_MACRO = "GLOBAL_MACRO"
MARKET_STRUCTURE = "MARKET_STRUCTURE"
CORPORATE = "CORPORATE"  # reserved — added as a dedicated provider later

# ── Importance ──
LOW = "LOW"
MEDIUM = "MEDIUM"
HIGH = "HIGH"
CRITICAL = "CRITICAL"

# ── Expected volatility hint (frontend refines into the full impact rating) ──
EXPANSION = "EXPANSION"
CONTRACTION = "CONTRACTION"
NEUTRAL = "NEUTRAL"

# ── Lifecycle status (computed at serve time from the clock) ──
SCHEDULED = "SCHEDULED"
LIVE = "LIVE"
COMPLETED = "COMPLETED"


@dataclass
class EventRecord:
    """One scheduled market event with full provenance.

    `type` is the stable canonical key for grouping the same event across time
    (e.g. every "US_CPI" print) — the hook the future Historical Event Analytics
    engine uses, so it can be added without changing this model.
    `id` is unique per occurrence (type + date).
    """
    id: str
    type: str
    name: str
    category: str
    country: str
    datetime: str               # ISO8601 WITH timezone (the scheduled time)
    importance: str
    expected_vol: str           # EXPANSION | CONTRACTION | NEUTRAL (hint)
    vol_magnitude: float        # 0..1 expected magnitude
    markets: list[str] = field(default_factory=list)
    sectors: list[str] = field(default_factory=list)
    description: str = ""
    source: str = ""
    source_url: str | None = None
    last_updated: str | None = None   # when last refreshed from the source
    last_checked: str | None = None   # when a refresh was last attempted

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "EventRecord":
        return EventRecord(
            id=d.get("id"), type=d.get("type"), name=d.get("name"),
            category=d.get("category"), country=d.get("country"),
            datetime=d.get("datetime"), importance=d.get("importance"),
            expected_vol=d.get("expected_vol", NEUTRAL),
            vol_magnitude=float(d.get("vol_magnitude", 0.0) or 0.0),
            markets=list(d.get("markets") or []),
            sectors=list(d.get("sectors") or []),
            description=d.get("description", ""),
            source=d.get("source", ""), source_url=d.get("source_url"),
            last_updated=d.get("last_updated"), last_checked=d.get("last_checked"),
        )
