"""DEFAULT market-data provider — yfinance (FX, DXY, US 10Y, commodities).

This is the ONE file to replace to move to an institutional feed. A Polygon /
FMP / Alpha Vantage / Refinitiv / Bloomberg / broker provider only needs to
implement `fetch() -> dict[str, MacroQuote]` returning the same keys; nothing
else in the macro subsystem, engine, or UI changes.
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from ..base import MacroQuote, LIVE, DELAYED, MARKET_CLOSED, NO_LIVE_DATA

# metric key -> Yahoo symbol. (US10Y ^TNX is already the yield in %, e.g. 4.28.)
_SYMBOLS: dict[str, str] = {
    "usdinr": "INR=X",
    "dxy": "DX-Y.NYB",
    "us10y": "^TNX",
    "crude": "BZ=F",      # Brent
    "gold": "GC=F",
    "silver": "SI=F",
    "copper": "HG=F",
}

_DELAYED_MAX_S = 40 * 3600     # last bar within ~40h -> DELAYED (recent session)
_CLOSED_MAX_S = 8 * 24 * 3600  # older (weekend/holiday gap) -> MARKET_CLOSED


def _classify(last_dt: datetime | None) -> tuple[str, float]:
    """(status, confidence) from the age of the last data point. yfinance daily
    data is never claimed LIVE — that is reserved for the real-time engine VIX."""
    if last_dt is None:
        return NO_LIVE_DATA, 0.0
    age = (datetime.now(timezone.utc) - last_dt).total_seconds()
    if age <= _DELAYED_MAX_S:
        return DELAYED, 0.7
    if age <= _CLOSED_MAX_S:
        return MARKET_CLOSED, 0.5
    return NO_LIVE_DATA, 0.0


class YFinanceMarketProvider:
    name = "Yahoo Finance"

    def fetch(self) -> dict[str, MacroQuote]:
        try:
            import yfinance as yf
        except Exception:
            return {k: MacroQuote(key=k, source=self.name, status=NO_LIVE_DATA)
                    for k in _SYMBOLS}

        # Reuse the market feed's lock so macro downloads never race the quant
        # engine's NIFTY/VIX/secondary downloads (yfinance is not thread-safe).
        try:
            from quant_engine.data import _YF_LOCK
        except Exception:
            import threading
            _YF_LOCK = threading.Lock()

        out: dict[str, MacroQuote] = {}
        for key, sym in _SYMBOLS.items():
            out[key] = self._one(yf, _YF_LOCK, key, sym)
        return out

    def _one(self, yf, lock, key: str, sym: str) -> MacroQuote:
        try:
            with lock:
                df = yf.download(sym, period="5d", interval="1d",
                                 progress=False, auto_adjust=False)
            if df is None or df.empty:
                return MacroQuote(key=key, source=self.name, status=NO_LIVE_DATA)
            if isinstance(df.columns, pd.MultiIndex):
                df = df.copy()
                df.columns = df.columns.get_level_values(0)
                df = df.loc[:, ~df.columns.duplicated()]
            if "Close" not in df.columns:
                return MacroQuote(key=key, source=self.name, status=NO_LIVE_DATA)
            closes = pd.to_numeric(df["Close"], errors="coerce").to_numpy(dtype=float).ravel()
            valid = ~np.isnan(closes)
            closes = closes[valid]
            if len(closes) == 0:
                return MacroQuote(key=key, source=self.name, status=NO_LIVE_DATA)
            idx = df.index[valid]
            last = float(closes[-1])
            prev = float(closes[-2]) if len(closes) > 1 else None
            last_dt = pd.to_datetime(idx[-1]).to_pydatetime()
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            status, conf = _classify(last_dt)
            return MacroQuote(
                key=key, value=round(last, 4), previous=round(prev, 4) if prev is not None else None,
                timestamp=last_dt.isoformat(), source=self.name,
                status=status, confidence=conf,
            )
        except Exception:
            return MacroQuote(key=key, source=self.name, status=NO_LIVE_DATA)
