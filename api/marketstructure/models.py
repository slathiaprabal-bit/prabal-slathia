"""Expiry data contract."""
from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass
class Expiry:
    instrument: str
    exchange: str
    kind: str            # WEEKLY | MONTHLY
    date: str            # adjusted expiry date (YYYY-MM-DD)
    datetime: str        # ISO8601 with tz at the 15:30 IST close
    weekday: int         # scheduled expiry weekday (pre-adjustment)
    adjusted: bool       # True if shifted off a holiday/weekend
    original_date: str   # the scheduled date before holiday adjustment

    def to_dict(self) -> dict:
        return asdict(self)
