"""Official data sources. Each is a swappable class implementing OfficialSource.

To move to an institutional feed (Bloomberg / Refinitiv / Polygon / FRED / a
direct RBI/MOSPI/NSE API) add ONE class here and register it in the scheduler's
priority list — the scheduler, provider, route and frontend never change.

Every source MUST return None (never raise, never fabricate) when it cannot
supply a value, so the scheduler can preserve the last-good official figure.
"""
from __future__ import annotations

import os
from datetime import date
from typing import Protocol, runtime_checkable

from .models import OfficialSpec, SourceResult


@runtime_checkable
class OfficialSource(Protocol):
    name: str
    def fetch(self, key: str) -> "SourceResult | None": ...


class SeedSource:
    """Bootstrap / last-resort source: the operator-entered official value from
    specs.py. Used only until a real source provides a value, or when none is
    configured. Never live, never fabricated — an explicit official figure."""
    name = "seed"

    def __init__(self, specs: list[OfficialSpec]):
        self._by = {s.key: s for s in specs}

    def fetch(self, key: str) -> SourceResult | None:
        s = self._by.get(key)
        if s and s.seed_value is not None:
            return SourceResult(value=float(s.seed_value), source=s.source_label,
                                release_date=s.seed_release_date)
        return None


class NseFlowsSource:
    """Real auto-source for FII/DII provisional cash, fetched from NSE EOD.
    Uses NSE's cookie-primed JSON endpoint (same pattern as the option chain).
    Returns None on any failure so the last-good figure is preserved."""
    name = "NSE"
    _BASE = "https://www.nseindia.com"
    _API = _BASE + "/api/fiidiiTradeReact"
    _HEADERS = {
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": _BASE + "/",
    }

    def fetch(self, key: str) -> SourceResult | None:
        if key not in ("fii", "dii"):
            return None
        try:
            import requests
        except Exception:
            return None
        try:
            s = requests.Session()
            s.headers.update(self._HEADERS)
            s.get(self._BASE, timeout=6)  # prime cookies
            r = s.get(self._API, timeout=8)
            if r.status_code != 200:
                return None
            data = r.json()
        except Exception:
            return None
        # NSE returns a list of category rows; pick FII/DII net (buy - sell).
        try:
            want = "FII" if key == "fii" else "DII"
            for row in (data if isinstance(data, list) else []):
                cat = str(row.get("category", "")).upper()
                if want in cat:
                    net = row.get("netValue")
                    if net is None:
                        buy = float(row.get("buyValue", 0) or 0)
                        sell = float(row.get("sellValue", 0) or 0)
                        net = buy - sell
                    rel = row.get("date") or date.today().isoformat()
                    return SourceResult(value=round(float(net), 2),
                                        source="NSE · provisional cash (EOD)",
                                        release_date=str(rel))
        except Exception:
            return None
        return None


class FredSource:
    """Real auto-source via the free FRED API (env FRED_API_KEY). Generic: fetches
    the latest observation of the series mapped on each spec. Returns None if no
    key, no mapping, or unreachable — a one-field change (`fred_series`) wires a
    metric without touching anything else."""
    name = "FRED"
    _URL = "https://api.stlouisfed.org/fred/series/observations"

    def __init__(self, specs: list[OfficialSpec]):
        self._by = {s.key: s for s in specs}
        self.api_key = os.getenv("FRED_API_KEY")

    def fetch(self, key: str) -> SourceResult | None:
        spec = self._by.get(key)
        if not self.api_key or not spec or not spec.fred_series:
            return None
        try:
            import requests
            r = requests.get(self._URL, timeout=8, params={
                "series_id": spec.fred_series, "api_key": self.api_key,
                "file_type": "json", "sort_order": "desc", "limit": 1,
            })
            if r.status_code != 200:
                return None
            obs = (r.json().get("observations") or [])
            if not obs:
                return None
            o = obs[0]
            val = o.get("value")
            if val in (None, ".", ""):
                return None
            return SourceResult(value=float(val), source=f"FRED · {spec.fred_series}",
                                release_date=o.get("date"))
        except Exception:
            return None
