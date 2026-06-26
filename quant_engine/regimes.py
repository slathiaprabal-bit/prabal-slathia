"""Market-regime classification engine (12 states).

Classifies the tape into one of twelve regimes from three orthogonal axes:

  * direction + trend strength  (price vs MA, normalised by ATR; MA slope)
  * volatility level            (IV rank / VIX band)
  * volatility dynamics         (VIX rising/falling = expansion/compression)

Each regime carries a trading policy: trade/skip, preferred strategy family,
a size multiplier and the rationale. Policies are deliberately conservative —
the mandate is capital preservation, so several regimes are explicitly NO-TRADE.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np
import pandas as pd

from .config import Config


class MarketRegime(str, Enum):
    STRONG_BULL = "STRONG_BULL"
    SLOW_BULL = "SLOW_BULL"
    STRONG_BEAR = "STRONG_BEAR"
    SLOW_BEAR = "SLOW_BEAR"
    SIDEWAYS_LOW_VOL = "SIDEWAYS_LOW_VOL"
    SIDEWAYS_HIGH_VOL = "SIDEWAYS_HIGH_VOL"
    EXPANSION = "EXPANSION"
    COMPRESSION = "COMPRESSION"
    PANIC = "PANIC"
    RECOVERY = "RECOVERY"
    DISTRIBUTION = "DISTRIBUTION"
    ACCUMULATION = "ACCUMULATION"


@dataclass
class RegimePolicy:
    trade: bool
    strategy_family: str   # neutral | bullish | bearish | none
    preferred: tuple       # ranked strategy names
    size_mult: float       # multiply base risk by this
    edge: str              # qualitative expected edge for a premium seller
    note: str = ""


# Policy table — conservative by design.
POLICY: dict[MarketRegime, RegimePolicy] = {
    MarketRegime.STRONG_BULL: RegimePolicy(
        True, "bullish", ("BULL_PUT_SPREAD", "JADE_LIZARD"), 0.8,
        "Sell puts into strength; avoid call side (squeeze risk)."),
    MarketRegime.SLOW_BULL: RegimePolicy(
        True, "neutral", ("IRON_CONDOR", "BULL_PUT_SPREAD"), 1.0,
        "Theta-friendly drift; condor skewed slightly bullish."),
    MarketRegime.STRONG_BEAR: RegimePolicy(
        True, "bearish", ("BEAR_CALL_SPREAD",), 0.6,
        "Sell calls into weakness; small size, falling-knife risk."),
    MarketRegime.SLOW_BEAR: RegimePolicy(
        True, "bearish", ("BEAR_CALL_SPREAD", "IRON_CONDOR"), 0.8,
        "Grind lower; call spreads with defined risk."),
    MarketRegime.SIDEWAYS_LOW_VOL: RegimePolicy(
        True, "neutral", ("IRON_FLY", "IRON_CONDOR"), 0.7,
        "Range-bound but thin premium; size down, tight structures."),
    MarketRegime.SIDEWAYS_HIGH_VOL: RegimePolicy(
        True, "neutral", ("IRON_CONDOR", "SHORT_STRANGLE"), 1.0,
        "Best premium-selling regime: rich IV, mean-reverting range."),
    MarketRegime.EXPANSION: RegimePolicy(
        False, "none", (), 0.0,
        "Vol expanding — short gamma is dangerous. Stand aside."),
    MarketRegime.COMPRESSION: RegimePolicy(
        True, "neutral", ("IRON_CONDOR", "CALENDAR"), 0.6,
        "Vol compressing; premium thin, breakout risk — small size."),
    MarketRegime.PANIC: RegimePolicy(
        False, "none", (), 0.0,
        "Crash regime. No new shorts. Protect capital."),
    MarketRegime.RECOVERY: RegimePolicy(
        True, "bullish", ("BULL_PUT_SPREAD",), 0.6,
        "Post-shock IV crush; sell puts cautiously as vol normalises."),
    MarketRegime.DISTRIBUTION: RegimePolicy(
        True, "bearish", ("BEAR_CALL_SPREAD", "IRON_CONDOR"), 0.7,
        "Topping/churn at highs; lean bearish, defined risk."),
    MarketRegime.ACCUMULATION: RegimePolicy(
        True, "bullish", ("BULL_PUT_SPREAD", "IRON_CONDOR"), 0.8,
        "Basing after weakness; sell puts as demand returns."),
}


@dataclass
class RegimeReading:
    regime: MarketRegime
    policy: RegimePolicy
    direction: str          # UP / DOWN / FLAT
    trend_strength: float   # normalised (close-MA)/ATR
    ma_slope: float         # % slope of MA over slope window
    vix: float
    vix_chg: float          # day-over-day VIX change (%)
    iv_rank: float
    confidence: float       # 0..100 heuristic


def _ma_slope(ma: pd.Series, window: int = 5) -> float:
    s = ma.dropna().tail(window + 1)
    if len(s) < window + 1 or s.iloc[0] == 0:
        return 0.0
    return float((s.iloc[-1] - s.iloc[0]) / s.iloc[0] * 100.0)


def classify(df: pd.DataFrame, config: Config, iv_rank: float | None = None) -> RegimeReading:
    row = df.iloc[-1]
    close = float(row["Close"]); ma = float(row["MA"]); atr = float(row["ATR"])
    vix = float(row["VIX"])
    prev_vix = float(df["VIX"].iloc[-2]) if len(df) > 1 else vix
    vix_chg = (vix - prev_vix) / prev_vix * 100.0 if prev_vix else 0.0
    slope = _ma_slope(df["MA"])
    ts = (close - ma) / atr if atr > 0 else 0.0       # trend strength in ATRs

    # 3-day return for panic/recovery detection.
    ret3 = (close / float(df["Close"].iloc[-4]) - 1.0) * 100.0 if len(df) > 4 else 0.0

    if iv_rank is None:
        iv_rank = 50.0

    # Direction.
    if ts > 0.5:
        direction = "UP"
    elif ts < -0.5:
        direction = "DOWN"
    else:
        direction = "FLAT"

    expanding = vix_chg > 8.0
    compressing = vix_chg < -8.0
    high_vol = vix >= config.vix_elevated
    low_vol = vix < config.vix_low

    # --- Decision tree (order matters: extremes first) ----------------- #
    if vix >= config.vix_elevated + 7 or (ret3 < -4 and expanding):
        regime = MarketRegime.PANIC
    elif ret3 < -3 and high_vol and expanding:
        regime = MarketRegime.STRONG_BEAR
    elif ret3 > 3 and high_vol and compressing:
        regime = MarketRegime.RECOVERY
    elif expanding and abs(ts) < 1.0:
        regime = MarketRegime.EXPANSION
    elif direction == "UP" and ts > 1.5 and slope > 0.3:
        regime = MarketRegime.STRONG_BULL
    elif direction == "DOWN" and ts < -1.5 and slope < -0.3:
        regime = MarketRegime.STRONG_BEAR
    elif direction == "UP":
        regime = MarketRegime.SLOW_BULL if iv_rank >= 40 else MarketRegime.ACCUMULATION
    elif direction == "DOWN":
        regime = MarketRegime.SLOW_BEAR if iv_rank >= 40 else MarketRegime.DISTRIBUTION
    else:  # FLAT
        if compressing or low_vol:
            regime = MarketRegime.COMPRESSION if compressing else MarketRegime.SIDEWAYS_LOW_VOL
        elif high_vol:
            regime = MarketRegime.SIDEWAYS_HIGH_VOL
        else:
            regime = MarketRegime.SIDEWAYS_LOW_VOL

    # Confidence: stronger trend / clearer vol signal => higher confidence.
    conf = 40 + min(40, abs(ts) * 15) + min(20, abs(vix_chg))
    conf = round(min(95.0, conf), 0)

    return RegimeReading(
        regime=regime, policy=POLICY[regime], direction=direction,
        trend_strength=round(ts, 2), ma_slope=round(slope, 3),
        vix=round(vix, 2), vix_chg=round(vix_chg, 1),
        iv_rank=round(iv_rank, 1), confidence=conf,
    )
