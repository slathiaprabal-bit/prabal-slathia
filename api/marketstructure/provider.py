"""MarketStructureProvider — deterministic per-instrument expiry computation.

The only place expiries are computed. Weekly/monthly weekdays come from config;
each expiry is holiday-adjusted to the previous trading day. Consumers
(ExpirySource, /api/market-structure, future Strategy Lab / Research) read from
here and never recompute.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from .config import INSTRUMENTS, HOLIDAYS, EXPIRY_TIME
from .models import Expiry


def _is_trading_day(d: date) -> bool:
    return d.weekday() < 5 and d.isoformat() not in HOLIDAYS


def _prev_trading_day(d: date) -> date:
    """Move back to the previous trading day if d is a weekend/holiday."""
    while not _is_trading_day(d):
        d -= timedelta(days=1)
    return d


def _last_weekday_of_month(year: int, month: int, weekday: int) -> date:
    nxt = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    d = nxt - timedelta(days=1)
    while d.weekday() != weekday:
        d -= timedelta(days=1)
    return d


def _weekly_dates(start: date, weekday: int, n: int) -> list[date]:
    d = start + timedelta(days=(weekday - start.weekday()) % 7)
    return [d + timedelta(days=7 * i) for i in range(n)]


class MarketStructureProvider:
    name = "NSE/BSE Market Structure"

    def instruments(self) -> list[str]:
        return list(INSTRUMENTS.keys())

    def _mk(self, instrument: str, exch: str, kind: str, scheduled: date, weekday: int) -> Expiry:
        adj = _prev_trading_day(scheduled)
        return Expiry(
            instrument=instrument, exchange=exch, kind=kind,
            date=adj.isoformat(), datetime=f"{adj.isoformat()}T{EXPIRY_TIME}",
            weekday=weekday, adjusted=(adj != scheduled),
            original_date=scheduled.isoformat(),
        )

    def expiries(self, instrument: str, weeks_ahead: int = 9, months_ahead: int = 4) -> list[Expiry]:
        cfg = INSTRUMENTS[instrument]
        exch = cfg["exchange"]
        today = datetime.now(timezone.utc).date()
        out: list[Expiry] = []

        if cfg.get("weekly") is not None:
            wd = cfg["weekly"]
            for d in _weekly_dates(today, wd, weeks_ahead):
                is_monthly = _last_weekday_of_month(d.year, d.month, wd) == d
                out.append(self._mk(instrument, exch, "MONTHLY" if is_monthly else "WEEKLY", d, wd))
        else:
            wd = cfg["monthly"]
            y, m = today.year, today.month
            for i in range(months_ahead):
                mm = (m - 1 + i) % 12 + 1
                yy = y + (m - 1 + i) // 12
                d = _last_weekday_of_month(yy, mm, wd)
                if _prev_trading_day(d) < today:
                    continue
                out.append(self._mk(instrument, exch, "MONTHLY", d, wd))

        out.sort(key=lambda e: e.date)
        return out

    def all_expiries(self, within_days: int = 60) -> list[Expiry]:
        today = datetime.now(timezone.utc).date()
        horizon = today + timedelta(days=within_days)
        out: list[Expiry] = []
        for inst in INSTRUMENTS:
            for e in self.expiries(inst):
                ed = date.fromisoformat(e.date)
                if today <= ed <= horizon:
                    out.append(e)
        out.sort(key=lambda e: (e.date, e.instrument))
        return out

    def next_expiry(self, instrument: str) -> Expiry | None:
        today = datetime.now(timezone.utc).date()
        for e in self.expiries(instrument):
            if date.fromisoformat(e.date) >= today:
                return e
        return None
