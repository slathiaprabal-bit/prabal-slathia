"""Volatility engine.

Realized-volatility term structure, IV rank/percentile (proxied from the India
VIX series), expected move, standard-deviation ranges and the probability of
the index expiring inside a given band.

Note on IV inputs: a *true* institutional vol engine consumes the live option
chain (ATM/OTM IV, skew, smile, term structure, vega/gamma surface). Without a
live NSE chain we proxy implied vol with India VIX (a 30-day, model-free IV
index). Skew/smile/surface require real per-strike IV and are stubbed with an
explicit caveat in `surface_note()`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict

import numpy as np
import pandas as pd

from .config import Config
from .pricing import _norm_cdf


def realized_vol(returns: pd.Series, window: int) -> float:
    """Annualised realized volatility over `window` trading days (decimal)."""
    r = returns.dropna().tail(window)
    if len(r) < max(5, window // 2):
        return float("nan")
    return float(r.std() * math.sqrt(252))


def hv_term_structure(returns: pd.Series, windows) -> Dict[int, float]:
    return {w: round(100 * realized_vol(returns, w), 2) for w in windows}


def iv_rank(vix_series: pd.Series, lookback: int) -> float:
    """IV Rank = (current - min) / (max - min) over the look-back, in %."""
    s = vix_series.dropna().tail(lookback)
    if len(s) < 20:
        return float("nan")
    lo, hi, cur = s.min(), s.max(), s.iloc[-1]
    if hi - lo < 1e-9:
        return 50.0
    return round(100 * (cur - lo) / (hi - lo), 1)


def iv_percentile(vix_series: pd.Series, lookback: int) -> float:
    """% of days over the look-back with IV below the current level."""
    s = vix_series.dropna().tail(lookback)
    if len(s) < 20:
        return float("nan")
    cur = s.iloc[-1]
    return round(100 * (s < cur).mean(), 1)


def expected_move(spot: float, iv_pct: float, days: int) -> float:
    """1-sigma expected move in points. iv_pct is annualised IV in percent."""
    return spot * (iv_pct / 100.0) * math.sqrt(max(days, 1) / 365.0)


def prob_inside(spot: float, lower: float, upper: float,
                iv_pct: float, days: int) -> float:
    """P(lower <= S_T <= upper) under a lognormal with vol=iv, drift~0.

    Returns a probability in [0,1]. Uses the risk-neutral-ish driftless
    approximation appropriate for short-dated premium selling.
    """
    sigma = (iv_pct / 100.0) * math.sqrt(max(days, 1) / 365.0)
    if sigma <= 0:
        return 1.0 if lower <= spot <= upper else 0.0
    # ln(S_T/S0) ~ N(-0.5 sigma^2, sigma^2)
    mu = -0.5 * sigma * sigma
    def cdf(x):
        return _norm_cdf((math.log(x / spot) - mu) / sigma)
    return round(max(0.0, min(1.0, cdf(upper) - cdf(lower))), 4)


@dataclass
class VolState:
    spot: float
    vix: float                       # current India VIX (IV proxy)
    hv: Dict[int, float] = field(default_factory=dict)
    iv_rank: float = float("nan")
    iv_pctile: float = float("nan")
    iv_minus_hv: float = float("nan")  # vol risk premium (IV - HV20)
    em_1d: float = 0.0
    em_expiry: float = 0.0
    sigma1_lo: float = 0.0
    sigma1_hi: float = 0.0
    sigma2_lo: float = 0.0
    sigma2_hi: float = 0.0
    p_inside_1sigma: float = 0.0

    def summary(self) -> str:
        return (f"VIX {self.vix:.1f} | IV-rank {self.iv_rank:.0f} | "
                f"HV20 {self.hv.get(20, float('nan')):.1f} | "
                f"VRP {self.iv_minus_hv:+.1f} | EM(exp) ±{self.em_expiry:.0f}")


def compute_vol_state(df: pd.DataFrame, config: Config) -> VolState:
    row = df.iloc[-1]
    spot = float(row["Close"])
    vix = float(row["VIX"])
    hv = hv_term_structure(df["Return"], config.hv_windows)

    em_expiry = expected_move(spot, vix, config.dte)
    em_1d = expected_move(spot, vix, 1)
    vs = VolState(
        spot=spot, vix=vix, hv=hv,
        iv_rank=iv_rank(df["VIX"], config.iv_rank_lookback),
        iv_pctile=iv_percentile(df["VIX"], config.iv_rank_lookback),
        iv_minus_hv=round(vix - hv.get(20, float("nan")), 2),
        em_1d=round(em_1d, 1), em_expiry=round(em_expiry, 1),
        sigma1_lo=round(spot - em_expiry, 1), sigma1_hi=round(spot + em_expiry, 1),
        sigma2_lo=round(spot - 2 * em_expiry, 1), sigma2_hi=round(spot + 2 * em_expiry, 1),
    )
    vs.p_inside_1sigma = prob_inside(spot, vs.sigma1_lo, vs.sigma1_hi, vix, config.dte)
    return vs


def surface_note() -> str:
    return ("Skew/smile/term-structure and vega/gamma surface require live "
            "per-strike IV from the NSE option chain; not derivable from VIX "
            "alone. Plug a chain feed into data.py to populate these.")
