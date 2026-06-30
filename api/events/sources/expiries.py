"""ExpirySource — COMPUTES NSE index-options expiries (deterministic).

Weekly / monthly / quarterly NIFTY expiries are rule-derived from the configured
expiry weekday, not fabricated. The weekday is configurable because SEBI/NSE have
changed it over time — set QT_WEEKLY_EXPIRY_DOW (0=Mon..6=Sun, default Thu=3) to
match the current rule. MSCI/FTSE rebalances and index reconstitutions need their
official effective dates and will arrive via a dedicated source (not guessed here).
"""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone

from ..models import EventRecord

_WEEKLY_DOW = int(os.getenv("QT_WEEKLY_EXPIRY_DOW", "3"))  # Thursday by default
_WEEKS_AHEAD = 8


def _next_weekday(d: date, dow: int) -> date:
    delta = (dow - d.weekday()) % 7
    return d + timedelta(days=delta)


class ExpirySource:
    name = "NSE (computed expiry schedule)"

    def fetch(self) -> list[EventRecord] | None:
        today = datetime.now(timezone.utc).date()
        out: list[EventRecord] = []
        d = _next_weekday(today, _WEEKLY_DOW)
        for _ in range(_WEEKS_AHEAD):
            is_monthly = (d + timedelta(days=7)).month != d.month
            is_quarterly = is_monthly and d.month in (3, 6, 9, 12)
            if is_quarterly:
                etype, label, imp, mag = "EXPIRY_QUARTERLY", "Quarterly Expiry", "HIGH", 0.6
                markets = ["NIFTY", "BANKNIFTY", "FINNIFTY"]
                desc = "Quarterly index-options expiry — heavy OI unwind; elevated pin/gamma risk into the close."
            elif is_monthly:
                etype, label, imp, mag = "EXPIRY_MONTHLY", "Monthly Expiry", "HIGH", 0.5
                markets = ["NIFTY", "BANKNIFTY", "FINNIFTY"]
                desc = "Monthly index-options expiry — large OI settles; gamma/pin risk near ATM into the close."
            else:
                etype, label, imp, mag = "EXPIRY_WEEKLY", "Weekly Expiry", "MEDIUM", 0.3
                markets = ["NIFTY"]
                desc = "Weekly NIFTY expiry — accelerated theta but ATM gamma/pin risk into the 15:30 close."
            dt = f"{d.isoformat()}T15:30:00+05:30"
            out.append(EventRecord(
                id=f"{etype}:{d.isoformat()}",
                type=etype, name=label, category="MARKET_STRUCTURE", country="IN",
                datetime=dt, importance=imp, expected_vol="CONTRACTION", vol_magnitude=mag,
                markets=markets, sectors=[], description=desc,
                source=self.name, source_url="https://www.nseindia.com/products-services/equity-derivatives-expiry-calendar",
            ))
            d = d + timedelta(days=7)
        return out
