"""Volatility history store — real day-over-day IV surface memory.

The terminal's smile/term overlays ("Yesterday", "5-Day Average") and the
surface day-change tooltip must come from REAL prior observations, never a
scaled copy of today's curve. This module persists one surface snapshot per
IST trading date (last write of the day wins) into a small JSON cache and
derives the history views the frontend consumes.

Alignment is by MONEYNESS (strike/spot), not absolute strike, so yesterday's
smile is comparable after the underlying moves. Tenor curves are read off each
day's ATM column at canonical tenors (7/14/30/60/90/180 DTE) *within* that
day's observed DTE range — tenors beyond the data are null, never extrapolated.
"""
from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timedelta, timezone

import numpy as np

_IST = timezone(timedelta(hours=5, minutes=30))
_PATH = os.path.join(os.path.dirname(__file__), "..", "quant_engine", "data",
                     "vol_history.json")
_KEEP_DAYS = 10          # retained snapshots
_WRITE_EVERY_S = 600     # throttle disk writes (snapshot builds run per-tick)

TENOR_LABELS = ["1W", "2W", "1M", "2M", "3M", "6M"]
TENOR_DTES = [7.0, 14.0, 30.0, 60.0, 90.0, 180.0]

_lock = threading.Lock()
_last_write = 0.0


def _load() -> dict:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save(store: dict) -> None:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)
    tmp = _PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(store, f)
    os.replace(tmp, _PATH)


def _atm_curve(spot: float, strikes: np.ndarray, grid: np.ndarray) -> np.ndarray:
    """ATM IV per expiry row — interpolated at moneyness 1.0, not nearest strike."""
    return np.array([np.interp(spot, strikes, grid[j]) for j in range(grid.shape[0])])


def _tenor_curve(spot: float, strikes: list, dtes: list, iv: list) -> list:
    """ATM IV at canonical tenors; null outside the observed DTE range."""
    s = np.asarray(strikes, dtype=float)
    d = np.asarray(dtes, dtype=float)
    g = np.asarray(iv, dtype=float)
    atm = _atm_curve(spot, s, g)
    out = []
    for t in TENOR_DTES:
        if d.min() - 1e-9 <= t <= d.max() + 1e-9:
            out.append(round(float(np.interp(t, d, atm)), 2))
        else:
            out.append(None)
    return out


def _smile_on(spot_today: float, strikes_today: np.ndarray, day: dict) -> np.ndarray | None:
    """A stored day's front-expiry smile re-sampled onto today's strike grid
    via moneyness. Returns None when the overlap is too small to be honest."""
    s_then = np.asarray(day["strikes"], dtype=float)
    iv_then = np.asarray(day["iv"], dtype=float)[0]      # front expiry row
    m_then = s_then / float(day["spot"])
    m_today = strikes_today / spot_today
    lo, hi = m_then.min(), m_then.max()
    cover = np.mean((m_today >= lo) & (m_today <= hi))
    if cover < 0.6:
        return None
    return np.interp(np.clip(m_today, lo, hi), m_then, iv_then)


def _surface_on(spot_today: float, strikes_today: np.ndarray, dtes_today: np.ndarray,
                day: dict) -> list | None:
    """A stored day's full grid re-sampled onto today's (moneyness × DTE) grid."""
    s_then = np.asarray(day["strikes"], dtype=float)
    d_then = np.asarray(day["dtes"], dtype=float)
    g_then = np.asarray(day["iv"], dtype=float)
    m_then = s_then / float(day["spot"])
    m_today = strikes_today / spot_today
    mc = np.clip(m_today, m_then.min(), m_then.max())
    # interp along strikes for each stored expiry, then along DTE per column
    rows = np.vstack([np.interp(mc, m_then, g_then[j]) for j in range(g_then.shape[0])])
    dc = np.clip(dtes_today, d_then.min(), d_then.max())
    out = np.vstack([np.interp(dc, d_then, rows[:, i]) for i in range(rows.shape[1])]).T
    return out.round(2).tolist()


def record_and_derive(spot: float, strikes: np.ndarray, dtes: np.ndarray,
                      grid: np.ndarray) -> dict:
    """Persist today's surface (throttled) and derive the history views.

    Returns the `volHistory` snapshot block. All fields are None/absent until
    real prior-day observations exist — the frontend renders honest empty
    states instead of fabricated curves.
    """
    global _last_write
    today = datetime.now(_IST).strftime("%Y-%m-%d")

    with _lock:
        store = _load()
        now = time.time()
        if today not in store or now - _last_write > _WRITE_EVERY_S:
            store[today] = {
                "spot": round(float(spot), 2),
                "strikes": np.asarray(strikes, dtype=float).round(2).tolist(),
                "dtes": np.asarray(dtes, dtype=float).round(2).tolist(),
                "iv": np.asarray(grid, dtype=float).round(2).tolist(),
            }
            for k in sorted(store)[:-_KEEP_DAYS]:
                del store[k]
            _save(store)
            _last_write = now

    prior_keys = sorted(k for k in store if k < today)
    ykey = prior_keys[-1] if prior_keys else None
    strikes = np.asarray(strikes, dtype=float)
    dtes = np.asarray(dtes, dtype=float)
    grid = np.asarray(grid, dtype=float)

    y_smile = avg5 = y_surface = y_tenors = None
    if ykey:
        y_smile_arr = _smile_on(spot, strikes, store[ykey])
        y_smile = y_smile_arr.round(2).tolist() if y_smile_arr is not None else None
        y_surface = _surface_on(spot, strikes, dtes, store[ykey])
        y = store[ykey]
        y_tenors = _tenor_curve(y["spot"], y["strikes"], y["dtes"], y["iv"])

    smiles5 = [sm for k in prior_keys[-5:]
               if (sm := _smile_on(spot, strikes, store[k])) is not None]
    if smiles5:
        avg5 = np.mean(np.vstack(smiles5), axis=0).round(2).tolist()

    # 5-day average tenor curve — mean of prior days' curves, per-tenor over the
    # days where that tenor was observed (null when never observed).
    tenors_avg5 = None
    prior5 = prior_keys[-5:]
    if prior5:
        cols: list[list[float]] = [[] for _ in TENOR_DTES]
        for k in prior5:
            d = store[k]
            for ti, v in enumerate(_tenor_curve(d["spot"], d["strikes"], d["dtes"], d["iv"])):
                if v is not None:
                    cols[ti].append(v)
        tenors_avg5 = [round(float(np.mean(c)), 2) if c else None for c in cols]

    return {
        "yesterdayDate": ykey,
        "days": len(prior_keys),
        "smileYesterday": y_smile,
        "smileAvg5": avg5,
        "surfaceYesterday": y_surface,
        "tenors": {
            "labels": TENOR_LABELS,
            "dte": TENOR_DTES,
            "today": _tenor_curve(spot, strikes.tolist(), dtes.tolist(), grid.tolist()),
            "yesterday": y_tenors,
            "avg5": tenors_avg5,
        },
    }
