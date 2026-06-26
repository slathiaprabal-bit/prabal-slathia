"""Regime detection and option-strategy signal generation.

The engine is a *premium-selling* model: it harvests option premium when
volatility is rich and the market is well-behaved, and stands aside when
volatility is dangerously high or an event gap appears.

    Regime           Market read                Strategy
    ---------------  -------------------------   ------------------------
    CALM   (low VIX)  range-bound / drifting     IRON_CONDOR  (sell both wings)
    NORMAL           trending up                 BULL_PUT_SPREAD (sell puts)
    NORMAL           trending down               BEAR_CALL_SPREAD (sell calls)
    ELEVATED         any                         single-side spread, smaller
    HIGH   (vix>cap) risk-off                    NO_TRADE
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from .config import Config
from .pricing import bs_price, implied_move


class Regime(str, Enum):
    CALM = "CALM"
    NORMAL = "NORMAL"
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"


class Trend(str, Enum):
    UP = "UP"
    DOWN = "DOWN"
    RANGE = "RANGE"


class Strategy(str, Enum):
    IRON_CONDOR = "IRON_CONDOR"
    BULL_PUT_SPREAD = "BULL_PUT_SPREAD"
    BEAR_CALL_SPREAD = "BEAR_CALL_SPREAD"
    NO_TRADE = "NO_TRADE"


@dataclass
class Leg:
    """One option leg. qty>0 = long (buy), qty<0 = short (sell)."""
    kind: str        # 'C' or 'P'
    strike: float
    qty: int         # in lots multiples handled by engine; here +/-1 per unit
    price: float = 0.0


@dataclass
class Signal:
    date: object
    spot: float
    vix: float
    regime: Regime
    trend: Trend
    strategy: Strategy
    legs: list = field(default_factory=list)
    credit: float = 0.0        # net premium received per lot-unit (points)
    max_risk: float = 0.0      # worst-case loss per lot-unit (points)
    expected_move: float = 0.0
    note: str = ""

    @property
    def short_call(self) -> Optional[float]:
        s = [l.strike for l in self.legs if l.kind == "C" and l.qty < 0]
        return s[0] if s else None

    @property
    def short_put(self) -> Optional[float]:
        s = [l.strike for l in self.legs if l.kind == "P" and l.qty < 0]
        return s[0] if s else None

    @property
    def is_tradable(self) -> bool:
        return self.strategy != Strategy.NO_TRADE and self.credit > 0


# --------------------------------------------------------------------------- #
def _round_strike(x: float, step: int) -> float:
    return round(x / step) * step


def detect_regime(vix: float, close: float, ma: float,
                  gap: float, config: Config) -> tuple[Regime, Trend]:
    # Volatility regime from India VIX bands.
    if vix < config.vix_low:
        regime = Regime.CALM
    elif vix < config.vix_normal:
        regime = Regime.NORMAL
    elif vix < config.vix_elevated:
        regime = Regime.ELEVATED
    else:
        regime = Regime.HIGH

    # Big overnight gap => treat as risk-off regardless of VIX band.
    if gap is not None and not math.isnan(gap) and abs(gap) > config.gap_threshold:
        if regime in (Regime.CALM, Regime.NORMAL):
            regime = Regime.ELEVATED

    # Trend from price vs moving average.
    if ma is None or math.isnan(ma):
        trend = Trend.RANGE
    elif close > ma * (1 + config.trend_band):
        trend = Trend.UP
    elif close < ma * (1 - config.trend_band):
        trend = Trend.DOWN
    else:
        trend = Trend.RANGE
    return regime, trend


def _price_leg(spot, strike, vix, t, rate, kind) -> float:
    return bs_price(spot, strike, t, vix / 100.0, rate, kind)


def generate_signal(date, spot: float, vix: float, ma: float, gap: float,
                    config: Config) -> Signal:
    """Build the recommended option structure for the given market state."""
    regime, trend = detect_regime(vix, spot, ma, gap, config)
    step = config.primary_instrument.strike_step
    t = config.dte / 365.0
    sigma_pts = implied_move(spot, vix, config.dte) * config.short_sigma
    wing = config.wing_steps * step

    sig = Signal(date=date, spot=spot, vix=vix, regime=regime, trend=trend,
                 strategy=Strategy.NO_TRADE, expected_move=sigma_pts)

    if regime == Regime.HIGH:
        sig.note = f"VIX {vix:.1f} > {config.vix_elevated}: risk-off, no new premium."
        return sig

    # Choose structure.
    if regime in (Regime.CALM,) and trend == Trend.RANGE:
        strategy = Strategy.IRON_CONDOR
    elif trend == Trend.UP:
        strategy = Strategy.BULL_PUT_SPREAD
    elif trend == Trend.DOWN:
        strategy = Strategy.BEAR_CALL_SPREAD
    else:
        # Range-bound but not super-calm -> condor with wider strikes.
        strategy = Strategy.IRON_CONDOR

    legs: list[Leg] = []

    def mk(kind, strike):
        return _price_leg(spot, strike, vix, t, config.risk_free_rate, kind)

    if strategy == Strategy.IRON_CONDOR:
        sc = _round_strike(spot + sigma_pts, step)
        sp = _round_strike(spot - sigma_pts, step)
        lc = sc + wing
        lp = sp - wing
        legs = [
            Leg("C", sc, -1, mk("C", sc)),
            Leg("C", lc, +1, mk("C", lc)),
            Leg("P", sp, -1, mk("P", sp)),
            Leg("P", lp, +1, mk("P", lp)),
        ]
    elif strategy == Strategy.BULL_PUT_SPREAD:
        sp = _round_strike(spot - sigma_pts, step)
        lp = sp - wing
        legs = [
            Leg("P", sp, -1, mk("P", sp)),
            Leg("P", lp, +1, mk("P", lp)),
        ]
    elif strategy == Strategy.BEAR_CALL_SPREAD:
        sc = _round_strike(spot + sigma_pts, step)
        lc = sc + wing
        legs = [
            Leg("C", sc, -1, mk("C", sc)),
            Leg("C", lc, +1, mk("C", lc)),
        ]

    # Net credit = premium received (short) - premium paid (long).
    credit = -sum(l.qty * l.price for l in legs)
    # Max risk for a defined-risk spread = wing width - credit (per side).
    if strategy == Strategy.IRON_CONDOR:
        max_risk = wing - credit
    else:
        max_risk = wing - credit
    max_risk = max(max_risk, 1.0)

    sig.strategy = strategy
    sig.legs = legs
    sig.credit = round(credit, 2)
    sig.max_risk = round(max_risk, 2)
    sig.note = f"{regime.value}/{trend.value}: sell ~{config.short_sigma:.0f}σ ({sigma_pts:.0f} pts)."

    # Reject structures with no edge (credit smaller than costs would eat).
    if credit <= 0:
        sig.strategy = Strategy.NO_TRADE
        sig.note = "No positive credit available; standing aside."
    return sig
