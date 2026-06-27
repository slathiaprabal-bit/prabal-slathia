"""Strategy ranking engine — V2 frontend layer.

Scores 54 option strategies against live market conditions from the quant
engine and returns the top-3 recommendations with score, confidence, EV,
POP, and natural-language reasoning.

Inputs come exclusively from vol_state / regime / signal already computed
by the unchanged quant engine. No trading logic lives here.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ──────────────────────── Strategy catalogue ────────────────────────────────
# Each entry is a plain dict; the scoring function reads these fields:
#   iv_bias  : "sell" | "buy" | "neutral"
#   iv_opt   : (min_ivr, max_ivr) — peak performance IVR range
#   regime   : {ui_regime_state: weight 0..2}  (missing keys default to 0.5)
#   dte_opt  : (min_dte, max_dte) optimal DTE window
#   risk     : "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH"
#   direct   : "bull" | "bear" | "neutral"
#   cred_f   : credit as fraction of em_expiry  (for short-premium)
#   loss_f   : max loss as fraction of em_expiry
#   deb_f    : debit as fraction of em_expiry   (for long-premium)
#   gain_f   : max gain as fraction of em_expiry

_R = {  # regime weight lookup presets
    "THETA": {
        "NORMAL": 2.0, "TRENDING_UP": 0.8, "TRENDING_DOWN": 0.8,
        "VOLATILE": 0.1, "EVENT_RISK": 0.2, "NO_GO": 0.0,
    },
    "WIDE_THETA": {
        "NORMAL": 1.5, "TRENDING_UP": 1.2, "TRENDING_DOWN": 1.2,
        "VOLATILE": 0.6, "EVENT_RISK": 0.5, "NO_GO": 0.0,
    },
    "BULL": {
        "TRENDING_UP": 2.0, "NORMAL": 0.8, "TRENDING_DOWN": 0.0,
        "VOLATILE": 0.4, "EVENT_RISK": 0.3, "NO_GO": 0.0,
    },
    "BEAR": {
        "TRENDING_DOWN": 2.0, "NORMAL": 0.8, "TRENDING_UP": 0.0,
        "VOLATILE": 0.4, "EVENT_RISK": 0.3, "NO_GO": 0.0,
    },
    "LONG_VOL": {
        "VOLATILE": 2.0, "EVENT_RISK": 2.0, "NO_GO": 1.5,
        "TRENDING_DOWN": 1.0, "TRENDING_UP": 0.6, "NORMAL": 0.2,
    },
    "CALENDAR": {
        "NORMAL": 1.8, "TRENDING_UP": 0.9, "TRENDING_DOWN": 0.9,
        "VOLATILE": 0.4, "EVENT_RISK": 1.2, "NO_GO": 0.2,
    },
    "EVENT": {
        "EVENT_RISK": 2.0, "VOLATILE": 1.5, "NO_GO": 0.8,
        "NORMAL": 0.3, "TRENDING_UP": 0.4, "TRENDING_DOWN": 0.5,
    },
}

CATALOG: List[Dict] = [
    # ─────────────────── THETA HARVEST (short premium) ───────────────────
    dict(code="WEEKLY_IC", name="Weekly Iron Condor",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(45, 100), regime=_R["THETA"], dte_opt=(5, 14),
         risk="MEDIUM", cred_f=0.18, loss_f=1.32),
    dict(code="MONTHLY_IC", name="Monthly Iron Condor",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(50, 100), regime=_R["THETA"], dte_opt=(21, 45),
         risk="MEDIUM", cred_f=0.22, loss_f=1.28),
    dict(code="IRON_FLY", name="Iron Butterfly",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(55, 100), regime=_R["THETA"], dte_opt=(7, 21),
         risk="MEDIUM", cred_f=0.60, loss_f=0.90),
    dict(code="WIDE_IC", name="Wide Iron Condor",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(40, 100), regime=_R["WIDE_THETA"], dte_opt=(14, 45),
         risk="LOW", cred_f=0.10, loss_f=1.40),
    dict(code="SHORT_STRANGLE", name="Short Strangle",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(60, 100), regime=_R["THETA"], dte_opt=(7, 30),
         risk="HIGH", cred_f=0.30, loss_f=3.50),
    dict(code="SHORT_STRADDLE", name="Short Straddle",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(65, 100), regime=_R["THETA"], dte_opt=(5, 14),
         risk="VERY_HIGH", cred_f=0.80, loss_f=5.00),
    dict(code="JADE_LIZARD", name="Jade Lizard",
         cat="theta", iv_bias="sell", direct="bull",
         iv_opt=(50, 85), regime={**_R["THETA"], "TRENDING_UP": 1.6},
         dte_opt=(7, 21), risk="MEDIUM", cred_f=0.25, loss_f=1.75),
    dict(code="BWB_PUT", name="Broken Wing Butterfly (Put)",
         cat="theta", iv_bias="sell", direct="bull",
         iv_opt=(45, 80), regime={**_R["THETA"], "TRENDING_UP": 1.5},
         dte_opt=(14, 30), risk="LOW", cred_f=0.08, loss_f=0.60),
    dict(code="BWB_CALL", name="Broken Wing Butterfly (Call)",
         cat="theta", iv_bias="sell", direct="bear",
         iv_opt=(45, 80), regime={**_R["THETA"], "TRENDING_DOWN": 1.5},
         dte_opt=(14, 30), risk="LOW", cred_f=0.08, loss_f=0.60),
    dict(code="RATIO_CALL", name="Call Ratio Write",
         cat="theta", iv_bias="sell", direct="bull",
         iv_opt=(55, 90), regime=_R["BULL"], dte_opt=(14, 45),
         risk="HIGH", cred_f=0.35, loss_f=4.00),
    dict(code="RATIO_PUT", name="Put Ratio Write",
         cat="theta", iv_bias="sell", direct="bear",
         iv_opt=(55, 90), regime=_R["BEAR"], dte_opt=(14, 45),
         risk="HIGH", cred_f=0.35, loss_f=4.00),
    dict(code="SHORT_WING_SPREAD", name="Short Wing Spread",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(50, 100), regime=_R["THETA"], dte_opt=(7, 21),
         risk="MEDIUM", cred_f=0.14, loss_f=1.36),
    dict(code="SKIP_FLY", name="Skip Strike Butterfly",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(50, 85), regime=_R["THETA"], dte_opt=(7, 21),
         risk="LOW", cred_f=0.06, loss_f=0.44),
    dict(code="CONDOR", name="Long Condor",
         cat="theta", iv_bias="sell", direct="neutral",
         iv_opt=(45, 80), regime=_R["THETA"], dte_opt=(14, 30),
         risk="LOW", cred_f=0.05, loss_f=0.45),

    # ──────────────── DIRECTIONAL SPREADS ────────────────────────────────
    dict(code="BULL_CALL_SPD", name="Bull Call Spread",
         cat="directional", iv_bias="neutral", direct="bull",
         iv_opt=(20, 60), regime=_R["BULL"], dte_opt=(14, 45),
         risk="LOW", deb_f=0.40, gain_f=1.10),
    dict(code="BEAR_PUT_SPD", name="Bear Put Spread",
         cat="directional", iv_bias="neutral", direct="bear",
         iv_opt=(20, 60), regime=_R["BEAR"], dte_opt=(14, 45),
         risk="LOW", deb_f=0.40, gain_f=1.10),
    dict(code="BULL_PUT_SPD", name="Bull Put Spread (Credit)",
         cat="directional", iv_bias="sell", direct="bull",
         iv_opt=(45, 85), regime=_R["BULL"], dte_opt=(7, 21),
         risk="MEDIUM", cred_f=0.14, loss_f=0.86),
    dict(code="BEAR_CALL_SPD", name="Bear Call Spread (Credit)",
         cat="directional", iv_bias="sell", direct="bear",
         iv_opt=(45, 85), regime=_R["BEAR"], dte_opt=(7, 21),
         risk="MEDIUM", cred_f=0.14, loss_f=0.86),
    dict(code="CALL_BACKSPREAD", name="Call Backspread 2:1",
         cat="directional", iv_bias="buy", direct="bull",
         iv_opt=(15, 45), regime={**_R["BULL"], "EVENT_RISK": 1.4},
         dte_opt=(14, 45), risk="MEDIUM", deb_f=0.05, gain_f=3.50),
    dict(code="PUT_BACKSPREAD", name="Put Backspread 2:1",
         cat="directional", iv_bias="buy", direct="bear",
         iv_opt=(15, 45), regime={**_R["BEAR"], "EVENT_RISK": 1.4},
         dte_opt=(14, 45), risk="MEDIUM", deb_f=0.05, gain_f=3.50),
    dict(code="BULL_LADDER", name="Bull Call Ladder",
         cat="directional", iv_bias="sell", direct="bull",
         iv_opt=(50, 90), regime=_R["BULL"], dte_opt=(14, 30),
         risk="HIGH", cred_f=0.10, loss_f=5.00),
    dict(code="BEAR_LADDER", name="Bear Put Ladder",
         cat="directional", iv_bias="sell", direct="bear",
         iv_opt=(50, 90), regime=_R["BEAR"], dte_opt=(14, 30),
         risk="HIGH", cred_f=0.10, loss_f=5.00),
    dict(code="RISK_REVERSAL_BULL", name="Risk Reversal (Bullish)",
         cat="directional", iv_bias="neutral", direct="bull",
         iv_opt=(30, 70), regime=_R["BULL"], dte_opt=(14, 45),
         risk="HIGH", deb_f=0.02, gain_f=4.00),
    dict(code="RISK_REVERSAL_BEAR", name="Risk Reversal (Bearish)",
         cat="directional", iv_bias="neutral", direct="bear",
         iv_opt=(30, 70), regime=_R["BEAR"], dte_opt=(14, 45),
         risk="HIGH", deb_f=0.02, gain_f=4.00),
    dict(code="SYNTHETIC_LONG", name="Synthetic Long",
         cat="directional", iv_bias="neutral", direct="bull",
         iv_opt=(25, 65), regime=_R["BULL"], dte_opt=(7, 30),
         risk="VERY_HIGH", deb_f=0.0, gain_f=6.00),
    dict(code="SYNTHETIC_SHORT", name="Synthetic Short",
         cat="directional", iv_bias="neutral", direct="bear",
         iv_opt=(25, 65), regime=_R["BEAR"], dte_opt=(7, 30),
         risk="VERY_HIGH", deb_f=0.0, gain_f=6.00),
    dict(code="PUT_FLY", name="Put Fly (Directional)",
         cat="directional", iv_bias="sell", direct="bear",
         iv_opt=(45, 80), regime=_R["BEAR"], dte_opt=(14, 30),
         risk="LOW", cred_f=0.05, loss_f=0.45),
    dict(code="CALL_FLY", name="Call Fly (Directional)",
         cat="directional", iv_bias="sell", direct="bull",
         iv_opt=(45, 80), regime=_R["BULL"], dte_opt=(14, 30),
         risk="LOW", cred_f=0.05, loss_f=0.45),

    # ─────────────── LONG VOLATILITY ────────────────────────────────────
    dict(code="LONG_STRADDLE", name="Long Straddle",
         cat="volatility", iv_bias="buy", direct="neutral",
         iv_opt=(0, 30), regime=_R["LONG_VOL"], dte_opt=(7, 30),
         risk="MEDIUM", deb_f=0.80, gain_f=4.00),
    dict(code="LONG_STRANGLE", name="Long Strangle",
         cat="volatility", iv_bias="buy", direct="neutral",
         iv_opt=(0, 35), regime=_R["LONG_VOL"], dte_opt=(7, 30),
         risk="MEDIUM", deb_f=0.30, gain_f=5.00),
    dict(code="LONG_CALL", name="Long Call (Vol Play)",
         cat="volatility", iv_bias="buy", direct="bull",
         iv_opt=(0, 35), regime={**_R["BULL"], **_R["LONG_VOL"]},
         dte_opt=(14, 60), risk="MEDIUM", deb_f=0.45, gain_f=6.00),
    dict(code="LONG_PUT", name="Long Put (Vol Play)",
         cat="volatility", iv_bias="buy", direct="bear",
         iv_opt=(0, 35), regime={**_R["BEAR"], **_R["LONG_VOL"]},
         dte_opt=(14, 60), risk="MEDIUM", deb_f=0.45, gain_f=6.00),
    dict(code="GAMMA_SCALP", name="Gamma Scalp Setup",
         cat="volatility", iv_bias="buy", direct="neutral",
         iv_opt=(0, 30), regime=_R["LONG_VOL"], dte_opt=(1, 7),
         risk="HIGH", deb_f=0.80, gain_f=5.00),
    dict(code="VOL_EXPANSION", name="Volatility Expansion Play",
         cat="volatility", iv_bias="buy", direct="neutral",
         iv_opt=(0, 25), regime=_R["LONG_VOL"], dte_opt=(7, 21),
         risk="HIGH", deb_f=0.40, gain_f=4.00),

    # ─────────────── CALENDAR / DIAGONAL ────────────────────────────────
    dict(code="LONG_CALENDAR", name="Long Calendar Spread",
         cat="calendar", iv_bias="neutral", direct="neutral",
         iv_opt=(35, 70), regime=_R["CALENDAR"], dte_opt=(7, 30),
         risk="LOW", deb_f=0.25, gain_f=0.75),
    dict(code="SHORT_CALENDAR", name="Short Calendar Spread",
         cat="calendar", iv_bias="neutral", direct="neutral",
         iv_opt=(55, 90), regime={"VOLATILE": 1.8, "NORMAL": 0.6, "EVENT_RISK": 1.5,
                                   "TRENDING_UP": 0.5, "TRENDING_DOWN": 0.5, "NO_GO": 0.2},
         dte_opt=(14, 45), risk="MEDIUM", cred_f=0.15, loss_f=1.85),
    dict(code="DOUBLE_CALENDAR", name="Double Calendar",
         cat="calendar", iv_bias="neutral", direct="neutral",
         iv_opt=(35, 70), regime=_R["CALENDAR"], dte_opt=(7, 30),
         risk="LOW", deb_f=0.50, gain_f=1.00),
    dict(code="DOUBLE_DIAGONAL", name="Double Diagonal",
         cat="calendar", iv_bias="sell", direct="neutral",
         iv_opt=(40, 75), regime=_R["CALENDAR"], dte_opt=(14, 45),
         risk="LOW", cred_f=0.08, loss_f=0.92),
    dict(code="DIAG_BULL", name="Diagonal Bull Spread",
         cat="calendar", iv_bias="neutral", direct="bull",
         iv_opt=(30, 65), regime={**_R["CALENDAR"], "TRENDING_UP": 1.7},
         dte_opt=(14, 45), risk="LOW", deb_f=0.30, gain_f=1.20),
    dict(code="DIAG_BEAR", name="Diagonal Bear Spread",
         cat="calendar", iv_bias="neutral", direct="bear",
         iv_opt=(30, 65), regime={**_R["CALENDAR"], "TRENDING_DOWN": 1.7},
         dte_opt=(14, 45), risk="LOW", deb_f=0.30, gain_f=1.20),
    dict(code="TIME_SPREAD", name="Time Spread (Theta Harvest)",
         cat="calendar", iv_bias="sell", direct="neutral",
         iv_opt=(45, 80), regime=_R["CALENDAR"], dte_opt=(7, 30),
         risk="LOW", cred_f=0.12, loss_f=0.88),

    # ──────────────── INSTITUTIONAL / COMPLEX ───────────────────────────
    dict(code="XMAS_TREE", name="Christmas Tree Butterfly",
         cat="institutional", iv_bias="sell", direct="neutral",
         iv_opt=(50, 85), regime=_R["THETA"], dte_opt=(14, 30),
         risk="LOW", cred_f=0.04, loss_f=0.46),
    dict(code="IRON_ALBATROSS", name="Iron Albatross",
         cat="institutional", iv_bias="sell", direct="neutral",
         iv_opt=(55, 90), regime=_R["THETA"], dte_opt=(14, 45),
         risk="MEDIUM", cred_f=0.09, loss_f=1.41),
    dict(code="COLLAR", name="Collar (Protective)",
         cat="institutional", iv_bias="sell", direct="bull",
         iv_opt=(40, 80), regime=_R["BULL"], dte_opt=(21, 60),
         risk="LOW", cred_f=0.05, loss_f=0.95),
    dict(code="SUPER_BULL", name="Super Bull (Synthetic+Spread)",
         cat="institutional", iv_bias="neutral", direct="bull",
         iv_opt=(25, 60), regime=_R["BULL"], dte_opt=(14, 45),
         risk="HIGH", deb_f=0.10, gain_f=5.00),
    dict(code="VEGA_NEUTRAL", name="Vega-Neutral Spread",
         cat="institutional", iv_bias="neutral", direct="neutral",
         iv_opt=(35, 65), regime=_R["CALENDAR"], dte_opt=(14, 60),
         risk="LOW", deb_f=0.15, gain_f=0.85),
    dict(code="TWISTED_SISTER", name="Twisted Sister (Inv Jade Lizard)",
         cat="institutional", iv_bias="sell", direct="bear",
         iv_opt=(50, 85), regime={**_R["THETA"], "TRENDING_DOWN": 1.6},
         dte_opt=(7, 21), risk="MEDIUM", cred_f=0.25, loss_f=1.75),
    dict(code="CONDOR_CALENDAR", name="Condor Calendar Spread",
         cat="institutional", iv_bias="neutral", direct="neutral",
         iv_opt=(40, 75), regime=_R["CALENDAR"], dte_opt=(14, 45),
         risk="MEDIUM", deb_f=0.35, gain_f=0.65),

    # ──────────────── EVENT STRATEGIES ──────────────────────────────────
    dict(code="PRE_EVENT_STRADDLE", name="Pre-Event Long Straddle",
         cat="event", iv_bias="buy", direct="neutral",
         iv_opt=(0, 40), regime=_R["EVENT"], dte_opt=(1, 7),
         risk="HIGH", deb_f=0.80, gain_f=6.00),
    dict(code="POST_EVENT_STRADDLE", name="Post-Event Short Straddle",
         cat="event", iv_bias="sell", direct="neutral",
         iv_opt=(60, 100), regime={"VOLATILE": 2.0, "NORMAL": 0.5, "EVENT_RISK": 1.8,
                                    "TRENDING_UP": 0.4, "TRENDING_DOWN": 0.4, "NO_GO": 0.0},
         dte_opt=(1, 5), risk="VERY_HIGH", cred_f=0.80, loss_f=5.00),
    dict(code="EVENT_WIDE_IC", name="Event Iron Condor (Wide Wings)",
         cat="event", iv_bias="sell", direct="neutral",
         iv_opt=(55, 100), regime=_R["EVENT"], dte_opt=(1, 7),
         risk="MEDIUM", cred_f=0.14, loss_f=1.36),
    dict(code="EXPIRY_DAY", name="Expiry Day Theta Harvest",
         cat="event", iv_bias="sell", direct="neutral",
         iv_opt=(50, 100), regime=_R["THETA"], dte_opt=(0, 1),
         risk="HIGH", cred_f=0.25, loss_f=2.00),
    dict(code="RATIO_WRITE", name="Ratio Write (Covered)",
         cat="event", iv_bias="sell", direct="bull",
         iv_opt=(55, 100), regime={**_R["BULL"], "VOLATILE": 0.8},
         dte_opt=(14, 45), risk="HIGH", cred_f=0.35, loss_f=5.00),
    dict(code="VEGA_HEDGE", name="Vega Hedge",
         cat="event", iv_bias="buy", direct="neutral",
         iv_opt=(0, 35), regime=_R["EVENT"], dte_opt=(14, 60),
         risk="LOW", deb_f=0.20, gain_f=3.00),
    dict(code="WEEKLY_EXP_BUTTER", name="Weekly Expiry Butterfly",
         cat="event", iv_bias="sell", direct="neutral",
         iv_opt=(45, 90), regime=_R["THETA"], dte_opt=(0, 2),
         risk="LOW", cred_f=0.04, loss_f=0.46),

    # ──────────────── NIFTY-SPECIFIC ────────────────────────────────────
    dict(code="NIFTY_7DTE_IC", name="NIFTY 7-Day Iron Condor",
         cat="nifty", iv_bias="sell", direct="neutral",
         iv_opt=(45, 100), regime=_R["THETA"], dte_opt=(6, 8),
         risk="MEDIUM", cred_f=0.20, loss_f=1.30),
    dict(code="NIFTY_MONTHLY_IC", name="NIFTY Monthly Iron Condor",
         cat="nifty", iv_bias="sell", direct="neutral",
         iv_opt=(50, 100), regime=_R["THETA"], dte_opt=(25, 35),
         risk="MEDIUM", cred_f=0.24, loss_f=1.26),
    dict(code="NIFTY_WEEKLY_FLY", name="NIFTY Weekly Butterfly",
         cat="nifty", iv_bias="sell", direct="neutral",
         iv_opt=(50, 90), regime=_R["THETA"], dte_opt=(4, 9),
         risk="LOW", cred_f=0.06, loss_f=0.44),
    dict(code="NIFTY_EXPIRY_THETA", name="NIFTY Expiry Theta Play",
         cat="nifty", iv_bias="sell", direct="neutral",
         iv_opt=(45, 100), regime=_R["THETA"], dte_opt=(0, 2),
         risk="HIGH", cred_f=0.30, loss_f=2.50),
    dict(code="NIFTY_WEEKLY_STRANGLE", name="NIFTY Weekly Strangle",
         cat="nifty", iv_bias="sell", direct="neutral",
         iv_opt=(55, 100), regime=_R["THETA"], dte_opt=(5, 10),
         risk="HIGH", cred_f=0.28, loss_f=3.20),
]


# ──────────────────────── Scoring logic ─────────────────────────────────────

@dataclass
class MarketConditions:
    spot: float
    vix: float
    iv_rank: float       # 0–100
    iv_pctile: float     # 0–100
    vrp: float           # IV – HV20  (can be NaN)
    regime: str          # UI regime state string
    confidence: float    # 0–100
    dte: int
    p_inside_1sigma: float   # 0–1
    em_expiry: float     # points (1σ expected move to expiry)
    lot_size: int = 75


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _score_strategy(s: Dict, c: MarketConditions) -> tuple[int, float, list[str]]:
    """Return (score 0-100, pop 0-100, reasoning_list)."""
    ivr = _clamp(c.iv_rank, 0, 100)
    vrp = c.vrp if math.isfinite(c.vrp) else 0.0
    regime = c.regime
    reasons: list[str] = []

    # ── 1. IV environment match (0–40 pts) ──────────────────────────────
    lo_iv, hi_iv = s["iv_opt"]
    if s["iv_bias"] == "sell":
        # Full score at ivr >= hi_iv; ramps from lo_iv
        if ivr >= lo_iv:
            iv_score = _clamp((ivr - lo_iv) / max(hi_iv - lo_iv, 1) * 40, 0, 40)
        else:
            iv_score = 0.0
        if ivr >= 70:
            reasons.append(f"IV Rank {ivr:.0f} — elevated premium, ideal for credit structures")
        elif ivr >= 50:
            reasons.append(f"IV Rank {ivr:.0f} — premium environment supports short vol")
        elif ivr >= 35:
            reasons.append(f"IV Rank {ivr:.0f} — moderate IV, limited edge for premium selling")
        else:
            reasons.append(f"IV Rank {ivr:.0f} — low IV reduces theta harvest appeal")
    elif s["iv_bias"] == "buy":
        # Full score at ivr <= lo_iv
        iv_score = _clamp((hi_iv - ivr) / max(hi_iv, 1) * 40, 0, 40)
        if ivr <= 20:
            reasons.append(f"IV Rank {ivr:.0f} — cheap volatility, long vega positions rewarded")
        elif ivr <= 35:
            reasons.append(f"IV Rank {ivr:.0f} — vol compressed, long premium has edge")
        else:
            reasons.append(f"IV Rank {ivr:.0f} — vol not cheap enough for aggressive long-gamma")
    else:  # neutral
        # Peak in the middle of range
        mid = (lo_iv + hi_iv) / 2
        iv_score = _clamp(40 - abs(ivr - mid) / max(mid, 1) * 30, 10, 40)

    # ── 2. Regime fit (0–25 pts) ─────────────────────────────────────────
    weight = s["regime"].get(regime, 0.5)
    regime_score = weight / 2.0 * 25
    if weight >= 1.8:
        reasons.append(f"{regime.replace('_', ' ')} regime — strongly favours this structure")
    elif weight >= 1.2:
        reasons.append(f"{regime.replace('_', ' ')} regime aligns with trade mechanics")

    # ── 3. VRP confirmation (0–15 pts) ──────────────────────────────────
    if s["iv_bias"] == "sell":
        vrp_score = _clamp(vrp / 5.0 * 15, 0, 15)
        if vrp > 3:
            reasons.append(f"VRP {vrp:+.1f} — implied vol significantly overpriced vs realized")
        elif vrp > 1:
            reasons.append(f"VRP {vrp:+.1f} — positive edge for volatility sellers")
    elif s["iv_bias"] == "buy":
        vrp_score = _clamp(-vrp / 5.0 * 15, 0, 15)
        if vrp < -2:
            reasons.append(f"VRP {vrp:+.1f} — realized vol running above IV, long gamma rewarded")
    else:
        vrp_score = 7.5  # neutral

    # ── 4. DTE fit (0–10 pts) ────────────────────────────────────────────
    lo_dte, hi_dte = s["dte_opt"]
    if lo_dte <= c.dte <= hi_dte:
        dte_score = 10.0
    elif c.dte < lo_dte:
        dte_score = max(0, 10 - (lo_dte - c.dte) * 1.5)
    else:
        dte_score = max(0, 10 - (c.dte - hi_dte) * 0.5)

    # ── 5. Probability confirmation (0–10 pts) ───────────────────────────
    p = c.p_inside_1sigma
    if s["iv_bias"] == "sell":
        prob_score = _clamp(p * 15 - 2, 0, 10)
        if p >= 0.70:
            reasons.append(f"P(inside 1σ) {p*100:.0f}% — strong probability range support")
    elif s["iv_bias"] == "buy":
        prob_score = _clamp((1 - p) * 15 - 2, 0, 10)
    else:
        prob_score = 5.0

    score = int(_clamp(iv_score + regime_score + vrp_score + dte_score + prob_score, 0, 100))

    # ── POP estimate ─────────────────────────────────────────────────────
    if s["iv_bias"] == "sell":
        pop = 50 + p * 25 + max(0, ivr - 50) * 0.15 + max(0, vrp) * 1.5
    elif s["iv_bias"] == "buy":
        pop = 40 + (1 - p) * 20 + max(0, -vrp) * 2.0
    else:
        pop = 50 + p * 10
    pop = _clamp(pop, 20, 88)

    return score, round(pop, 1), reasons


def _ev_risk(s: Dict, c: MarketConditions) -> tuple[float, float, float]:
    """Return (ev_per_lot, max_gain_per_lot, max_loss_per_lot) in INR."""
    em = c.em_expiry
    lot = c.lot_size
    score, pop, _ = _score_strategy(s, c)
    pop_f = pop / 100.0

    if s["iv_bias"] == "sell" or "cred_f" in s:
        credit = s.get("cred_f", 0.15) * em * lot
        max_loss = s.get("loss_f", 1.35) * em * lot
        ev = credit * pop_f - max_loss * (1 - pop_f)
        return round(ev, 0), round(credit, 0), round(max_loss, 0)
    else:
        debit = s.get("deb_f", 0.40) * em * lot
        max_gain = s.get("gain_f", 2.00) * em * lot
        ev = max_gain * pop_f - debit * (1 - pop_f)
        return round(ev, 0), round(max_gain, 0), round(debit, 0)


# ──────────────────────── Public API ────────────────────────────────────────

@dataclass
class StrategyResult:
    code: str
    name: str
    category: str
    score: int
    confidence: float
    ev: float
    pop: float
    maxGain: float
    maxLoss: float
    rrRatio: float
    risk: str
    directional: str
    reasoning: list[str]
    ranked: int = 0


def rank_strategies(c: MarketConditions) -> dict:
    """Score all catalogue strategies and return the full ranking + top 3."""
    results: list[StrategyResult] = []
    for s in CATALOG:
        score, pop, reasons = _score_strategy(s, c)
        ev, max_gain, max_loss = _ev_risk(s, c)
        rr = round(max_gain / max(max_loss, 1), 3)
        confidence = _clamp(
            0.4 * score + 0.3 * c.confidence + 0.3 * pop,
            0, 100
        )
        results.append(StrategyResult(
            code=s["code"],
            name=s["name"],
            category=s["cat"],
            score=score,
            confidence=round(confidence, 1),
            ev=ev,
            pop=pop,
            maxGain=max_gain,
            maxLoss=max_loss,
            rrRatio=rr,
            risk=s["risk"],
            directional=s["direct"],
            reasoning=reasons,
        ))

    results.sort(key=lambda r: (r.score, r.ev), reverse=True)
    for i, r in enumerate(results[:3]):
        r.ranked = i + 1

    # Market condition summary
    ivr = c.iv_rank
    regime = c.regime.replace("_", " ")
    if ivr >= 70:
        mkt = f"HIGH IV RANK ({ivr:.0f}) — premium-selling favoured"
    elif ivr >= 50:
        mkt = f"ELEVATED IV RANK ({ivr:.0f}) — credit structures viable"
    elif ivr <= 20:
        mkt = f"LOW IV RANK ({ivr:.0f}) — long volatility has edge"
    else:
        mkt = f"NEUTRAL IV RANK ({ivr:.0f}) — select structures by regime"
    mkt += f" · {regime} regime · VIX {c.vix:.1f}"

    return {
        "top3": [
            {
                "code": r.code,
                "name": r.name,
                "category": r.category,
                "score": r.score,
                "confidence": r.confidence,
                "ev": r.ev,
                "pop": r.pop,
                "maxGain": r.maxGain,
                "maxLoss": r.maxLoss,
                "rrRatio": r.rrRatio,
                "risk": r.risk,
                "directional": r.directional,
                "reasoning": r.reasoning,
                "ranked": r.ranked,
            }
            for r in results[:3]
        ],
        "totalScored": len(results),
        "marketCondition": mkt,
        "allScores": {r.code: r.score for r in results},
    }
