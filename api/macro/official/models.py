"""Data contracts for the Official Data subsystem."""
from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass
class OfficialSpec:
    """Per-indicator schedule + bootstrap. The bootstrap seed is an
    operator-entered official value used ONLY until a real source provides one;
    it is never treated as live and never fabricated."""
    key: str
    source_label: str          # default human source label
    check_interval_h: float    # how often to re-check the source
    next_release: str | None   # known next scheduled release (ISO date)
    seed_value: float | None   # bootstrap value
    seed_release_date: str | None  # asof (release date) of the bootstrap value
    fred_series: str | None = None  # FRED series id, if FRED can supply this key


@dataclass
class SourceResult:
    """What a source returns for one metric (None means 'cannot provide')."""
    value: float
    source: str
    release_date: str | None = None   # asof of the data point


@dataclass
class OfficialReading:
    """Cached, persisted state for one official metric — full provenance."""
    key: str
    value: float | None
    source: str
    release_date: str | None    # asof of the official data point
    next_release: str | None    # next scheduled release
    last_updated: str | None    # when the value was last obtained
    last_checked: str | None    # when a fetch was last attempted
    next_check: str | None      # when to attempt the next fetch
    status: str                 # OFFICIAL | NO_LIVE_DATA

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "OfficialReading":
        return OfficialReading(**{k: d.get(k) for k in OfficialReading.__annotations__})
