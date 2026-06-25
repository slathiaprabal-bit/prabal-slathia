"""Black-Scholes option pricing utilities.

Used both to build a synthetic option chain (when live chain data is absent)
and to mark-to-market short premium spreads inside the backtest.
"""

from __future__ import annotations

import math


def _norm_cdf(x: float) -> float:
    """Standard normal CDF without SciPy."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def bs_price(spot: float, strike: float, t: float, vol: float,
             rate: float = 0.066, kind: str = "C") -> float:
    """European Black-Scholes price.

    spot, strike : underlying & strike
    t            : time to expiry in YEARS
    vol          : annualised volatility (decimal, e.g. 0.15)
    rate         : risk-free rate (decimal)
    kind         : 'C' (call) or 'P' (put)
    """
    if t <= 0 or vol <= 0:
        # Intrinsic value at/after expiry.
        if kind.upper().startswith("C"):
            return max(0.0, spot - strike)
        return max(0.0, strike - spot)

    d1 = (math.log(spot / strike) + (rate + 0.5 * vol * vol) * t) / (vol * math.sqrt(t))
    d2 = d1 - vol * math.sqrt(t)
    if kind.upper().startswith("C"):
        return spot * _norm_cdf(d1) - strike * math.exp(-rate * t) * _norm_cdf(d2)
    return strike * math.exp(-rate * t) * _norm_cdf(-d2) - spot * _norm_cdf(-d1)


def implied_move(spot: float, vix: float, days: int) -> float:
    """Expected 1-sigma move (in points) implied by India VIX over `days`.

    India VIX is an annualised IV in percent, so the daily/period sigma is
    vix/100 * sqrt(days/365).
    """
    return spot * (vix / 100.0) * math.sqrt(max(days, 1) / 365.0)
