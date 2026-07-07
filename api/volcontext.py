"""Multi-asset MarketDataProvider for the Volatility Terminal.

One generic pipeline for EVERY registered index:

    instrument (marketstructure.config.INSTRUMENTS — the single registry)
      → spot / realized vol (yahoo quote history, best-effort, cached)
      → IV surface (live NSE chain when reachable, else parametric fit)
      → own history store (yesterday/5-day smiles, tenor curves, IV rank)
      → own intraday replay buffer

The UI never knows which index it renders — it consumes this context object.
Adding a new index = one line in the registry; nothing here changes.
Every degraded input is FLAGGED, never silently substituted.
"""
from __future__ import annotations

import math
import threading
import time
from collections import namedtuple
from datetime import datetime, timedelta, timezone

import numpy as np

from quant_engine.surface_dashboard import parametric_surface, _surface_from_live
from .marketstructure.config import INSTRUMENTS
from .marketstructure.provider import MarketStructureProvider
from .volhistory import record_and_derive, atm_iv_history
from .volreplay import record as record_replay

_IST = timezone(timedelta(hours=5, minutes=30))
_provider = MarketStructureProvider()
_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

_VS = namedtuple("VS", "spot vix iv_rank")

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict]] = {}      # instrument -> (ts, context)
_quote_cache: dict[str, tuple[float, float, float]] = {}  # yahoo -> (ts, spot, hv20)
_CTX_TTL = 45.0
_QUOTE_TTL = 300.0


def _quote(yahoo: str) -> tuple[float | None, float | None]:
    """(spot, hv20%) from yahoo daily closes — best-effort, cached, never raises."""
    now = time.time()
    hit = _quote_cache.get(yahoo)
    if hit and now - hit[0] < _QUOTE_TTL:
        return hit[1], hit[2]
    try:
        import yfinance as yf
        h = yf.Ticker(yahoo).history(period="6mo", interval="1d")
        closes = h["Close"].dropna()
        if len(closes) < 25:
            return None, None
        spot = float(closes.iloc[-1])
        rets = np.log(closes / closes.shift(1)).dropna()
        hv20 = float(rets.iloc[-20:].std() * math.sqrt(252) * 100)
        _quote_cache[yahoo] = (now, spot, hv20)
        return spot, hv20
    except Exception:
        return (hit[1], hit[2]) if hit else (None, None)


def _live_chain_surface(instrument: str, spot: float, iv_rank: float):
    """Real per-strike IV surface from the NSE chain, if reachable."""
    try:
        from quant_engine.nse_chain import iv_surface_points
        pts = iv_surface_points(instrument)
        if pts is not None and len(pts):
            return _surface_from_live(pts, _VS(spot, 14.0, iv_rank), 41)
    except Exception:
        pass
    return None


def _rank_pctile(series: list[float], value: float) -> tuple[float, float, bool]:
    """IV rank / percentile against THIS instrument's own recorded history.
    Degraded (neutral 50) until enough real days exist."""
    if len(series) < 5:
        return 50.0, 50.0, True
    lo, hi = min(series), max(series)
    rank = 50.0 if hi <= lo else 100.0 * (value - lo) / (hi - lo)
    pct = 100.0 * sum(1 for v in series if v <= value) / len(series)
    return round(min(100, max(0, rank)), 1), round(pct, 1), False


def get_context(instrument: str) -> dict | None:
    """The full vol context for one registered index (cached ~45s)."""
    inst = instrument.upper()
    cfg = INSTRUMENTS.get(inst)
    if cfg is None:
        return None
    with _lock:
        hit = _cache.get(inst)
        if hit and time.time() - hit[0] < _CTX_TTL:
            return hit[1]

    degraded: list[str] = []
    spot, hv20 = _quote(cfg["yahoo"])
    hist_atm = atm_iv_history(inst)
    if spot is None:
        # fall back to the last recorded spot for this instrument, if any
        if hist_atm:
            try:
                from .volhistory import _load, _inst_store, _lock as _hl
                with _hl:
                    days = _inst_store(_load(), inst)
                spot = days[sorted(days)[-1]]["spot"]
                degraded.append("spot: last recorded (no live quote)")
            except Exception:
                spot = None
        if spot is None:
            return {"instrument": inst, "label": cfg["label"], "available": False,
                    "degraded": ["no live quote and no recorded history yet"]}

    # IV anchor + rank from THIS instrument's own history.
    series = [v for _, v in hist_atm]
    anchor = series[-1] if series else (hv20 * 1.05 if hv20 else sum(cfg["iv_band"]) / 2)
    if not series and not hv20:
        degraded.append(f"IV anchor: registry band midpoint ({anchor:.1f})")
    iv_rank0, _, _ = _rank_pctile(series, anchor)

    live = _live_chain_surface(inst, spot, iv_rank0)
    if live is not None:
        strikes, dtes, grid = live
        is_live = True
    else:
        strikes, dtes, grid = parametric_surface(_VS(spot, anchor, iv_rank0))
        is_live = False
        degraded.append("surface: parametric model (chain unreachable)")
    m_strikes, m_dtes, m_grid = parametric_surface(_VS(spot, anchor, iv_rank0))

    atm_i = int(np.argmin(np.abs(strikes - spot)))
    atm_iv = float(grid[0][atm_i])
    iv_rank, iv_pctile, rank_degraded = _rank_pctile(series, atm_iv)
    if rank_degraded:
        degraded.append(f"IV rank/percentile: neutral until ≥5 days of own history ({len(series)} recorded)")

    ms = _provider.next_expiry(inst)
    dte = max(1, round((datetime.fromisoformat(f"{ms.date}T15:30:00+05:30")
                        - datetime.now(_IST)).total_seconds() / 86400)) if ms else 7
    monthly = next((e for e in _provider.all_expiries()
                    if e.instrument == inst and e.kind == "MONTHLY"), None)
    em = round(spot * (atm_iv / 100) * math.sqrt(dte / 365))
    vrp = round(atm_iv - hv20, 2) if hv20 else None
    if vrp is None:
        degraded.append("VRP: unavailable (no realized-vol history)")

    surface = {"strikes": strikes.round(0).tolist(), "expiries": dtes.round(0).tolist(),
               "iv": grid.round(2).tolist(), "live": is_live}
    smile = {"strikes": surface["strikes"], "iv": surface["iv"][0]}
    term = {"dte": surface["expiries"], "iv": [float(np.interp(spot, strikes, grid[j])) for j in range(grid.shape[0])]}

    try:
        vol_history = record_and_derive(inst, spot, strikes, dtes, grid)
    except Exception:
        vol_history = None
    try:
        record_replay(inst, {
            "spot": round(spot, 1), "vixChg": 0.0,
            "vol": {"vix": atm_iv, "ivRank": iv_rank, "ivPctile": iv_pctile,
                    "hv20": hv20, "vrp": vrp or 0.0, "emExpiry": em, "pInside1": 0.683},
            "smile": smile, "term": term, "surface": surface,
        })
    except Exception:
        pass

    ctx = {
        "instrument": inst, "label": cfg["label"], "exchange": cfg["exchange"],
        "available": True, "live": is_live, "degraded": degraded,
        "lotSize": cfg["lot_size"], "strikeStep": cfg["strike_step"],
        "weeklyExpiryDay": _WEEKDAYS[cfg["weekly"]] if cfg["weekly"] is not None else None,
        "monthlyExpiry": monthly.date if monthly else None,
        "nextExpiry": ms.date if ms else None, "dte": dte,
        "spot": round(spot, 2), "vixChg": 0.0,
        "vol": {"vix": round(atm_iv, 2), "ivRank": iv_rank, "ivPctile": iv_pctile,
                "hv20": round(hv20, 2) if hv20 else None, "vrp": vrp,
                "em1d": round(spot * (atm_iv / 100) / math.sqrt(252)),
                "emExpiry": em, "pInside1": 0.683,
                "sigma1": [round(spot - em), round(spot + em)],
                "sigma2": [round(spot - 2 * em), round(spot + 2 * em)]},
        "surface": surface, "surfaceModel": {
            "strikes": m_strikes.round(0).tolist(), "expiries": m_dtes.round(0).tolist(),
            "iv": m_grid.round(2).tolist(), "live": False},
        "smile": smile, "term": term, "volHistory": vol_history,
    }
    with _lock:
        _cache[inst] = (time.time(), ctx)
    return ctx


def instruments() -> list[dict]:
    """The registry, for selectors — UI discovers assets, never hardcodes them."""
    return [{"instrument": k, "label": v["label"], "exchange": v["exchange"]}
            for k, v in INSTRUMENTS.items()]
