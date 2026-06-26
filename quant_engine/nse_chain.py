"""Live NSE option-chain feed.

Fetches the official NSE index option-chain JSON and shapes it into the frames
the rest of the engine expects:

  * ``nearest_expiry_frame(symbol)`` -> the front-expiry chain
    [Strike, CE_OI, PE_OI, CE_IV, PE_IV, _t]  (consumed by positioning.py for
    Max Pain / PCR / GEX / S-R)
  * ``iv_surface_points(symbol)``    -> tidy [Strike, DTE, IV] across all listed
    expiries (consumed by the dashboard to draw a *real* IV surface)

The NSE endpoint needs a primed cookie (hit the homepage first) and browser-like
headers, and it rate-limits, so responses are cached in-process for a short TTL.
Every public function returns ``None`` on any failure (no network, blocked
egress, schema change, throttling) so callers transparently fall back to the
synthetic profile — the engine never hard-depends on the live feed.
"""

from __future__ import annotations

import time
from datetime import date, datetime

import pandas as pd

_BASE = "https://www.nseindia.com"
_API = _BASE + "/api/option-chain-indices?symbol={sym}"
_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": _BASE + "/option-chain",
}
# NSE index option-chain symbols (indices only).
_SYMBOLS = {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"}

_TTL = 45.0                       # seconds; NSE rate-limits aggressively
_CACHE: dict[str, tuple[float, dict]] = {}


def _fetch_json(symbol: str) -> dict | None:
    """Fetch (and briefly cache) the raw option-chain JSON for an index."""
    sym = symbol.upper()
    if sym not in _SYMBOLS:
        return None
    now = time.time()
    hit = _CACHE.get(sym)
    if hit and now - hit[0] < _TTL:
        return hit[1]

    try:
        import requests
    except Exception:
        return None

    try:
        s = requests.Session()
        s.headers.update(_HEADERS)
        # Prime cookies on the homepage / option-chain page, then hit the API.
        s.get(_BASE, timeout=6)
        s.get(_BASE + "/option-chain", timeout=6)
        r = s.get(_API.format(sym=sym), timeout=8)
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception:
        return None

    if not isinstance(data, dict) or "records" not in data:
        return None
    _CACHE[sym] = (now, data)
    return data


def _records_frame(data: dict) -> pd.DataFrame | None:
    """Flatten records.data into [Strike, Expiry, CE_OI, PE_OI, CE_IV, PE_IV]."""
    try:
        rows = data["records"]["data"]
    except Exception:
        return None
    out = []
    for it in rows:
        K = it.get("strikePrice")
        exp = it.get("expiryDate")
        if K is None or exp is None:
            continue
        ce, pe = it.get("CE") or {}, it.get("PE") or {}
        out.append({
            "Strike": float(K), "Expiry": exp,
            "CE_OI": float(ce.get("openInterest", 0) or 0),
            "PE_OI": float(pe.get("openInterest", 0) or 0),
            "CE_IV": float(ce.get("impliedVolatility", 0) or 0),
            "PE_IV": float(pe.get("impliedVolatility", 0) or 0),
        })
    if not out:
        return None
    return pd.DataFrame(out)


def _dte(expiry: str) -> float:
    """Days-to-expiry from an NSE '%d-%b-%Y' date string (>= ~0)."""
    d = datetime.strptime(expiry, "%d-%b-%Y").date()
    return max((d - date.today()).days, 0)


def nearest_expiry_frame(symbol: str) -> pd.DataFrame | None:
    """Front-expiry chain in the schema positioning.analyze_chain expects."""
    data = _fetch_json(symbol)
    if data is None:
        return None
    fr = _records_frame(data)
    if fr is None:
        return None
    # Pick the nearest non-expired expiry.
    fr["_dte"] = fr["Expiry"].map(_dte)
    front = fr[fr["_dte"] >= 0]["_dte"].min()
    sub = fr[fr["_dte"] == front].copy()
    if sub.empty:
        return None
    sub["_t"] = max(front, 0.5) / 365.0
    # Carry a sensible IV: NSE reports 0 IV on illiquid strikes; leave as-is,
    # analyze_chain only uses CE_IV for gamma and tolerates it.
    return sub[["Strike", "CE_OI", "PE_OI", "CE_IV", "PE_IV", "_t"]].reset_index(drop=True)


def iv_surface_points(symbol: str) -> pd.DataFrame | None:
    """Tidy [Strike, DTE, IV] across all listed expiries for the vol surface.

    IV per strike/expiry = mean of the non-zero CE/PE implied vols (NSE quotes 0
    on dead strikes; those are dropped so they don't flatten the surface).
    """
    data = _fetch_json(symbol)
    if data is None:
        return None
    fr = _records_frame(data)
    if fr is None:
        return None
    fr["DTE"] = fr["Expiry"].map(_dte)
    ivs = fr[["CE_IV", "PE_IV"]].where(fr[["CE_IV", "PE_IV"]] > 0)
    fr["IV"] = ivs.mean(axis=1)
    out = fr.dropna(subset=["IV"])
    out = out[(out["IV"] > 1) & (out["DTE"] >= 0)]
    if len(out) < 8:
        return None
    return out[["Strike", "DTE", "IV"]].reset_index(drop=True)
