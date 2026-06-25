"""Central configuration for the quant engine.

Everything tunable lives here so the rest of the code stays declarative.
Lot sizes / thresholds reflect the NSE index-options market and can be edited
freely without touching the engine.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict

DATA_DIR = Path(__file__).resolve().parent / "data"


@dataclass(frozen=True)
class Instrument:
    name: str
    yahoo_symbol: str        # symbol used for live download
    lot_size: int            # NSE contract lot size
    strike_step: int         # spacing between listed strikes


@dataclass
class Config:
    # ---- Capital & risk -------------------------------------------------
    capital: float = 1_000_000.0          # starting equity (INR)
    risk_per_trade: float = 0.02          # fraction of equity risked per trade
    max_risk_per_trade: float = 0.04      # hard cap
    max_lots: int = 50                    # absolute position cap
    daily_loss_limit: float = 0.05        # halt new trades after this daily loss

    # Drawdown throttle: scale size down as the equity curve bleeds.
    # key = drawdown threshold (fraction), value = size multiplier below it.
    drawdown_throttle: Dict[float, float] = field(default_factory=lambda: {
        0.05: 0.75,   # >5% DD  -> 75% size
        0.10: 0.50,   # >10% DD -> 50% size
        0.15: 0.25,   # >15% DD -> 25% size
        0.20: 0.0,    # >20% DD -> stop trading
    })

    # ---- Instruments ----------------------------------------------------
    instruments: Dict[str, Instrument] = field(default_factory=lambda: {
        "NIFTY": Instrument("NIFTY", "^NSEI", lot_size=75, strike_step=50),
        "BANKNIFTY": Instrument("BANKNIFTY", "^NSEBANK", lot_size=35, strike_step=100),
    })
    primary: str = "NIFTY"
    vix_symbol: str = "^INDIAVIX"

    # ---- Regime detection (India VIX bands) -----------------------------
    vix_low: float = 13.0        # <  low  -> calm / premium-selling sweet spot
    vix_normal: float = 18.0     # low..normal -> normal
    vix_elevated: float = 25.0   # normal..elevated -> elevated
    #                              > elevated -> high / risk-off

    trend_ma: int = 20           # SMA window for trend classification
    trend_band: float = 0.015    # +/-1.5% of MA counts as "range-bound"
    atr_window: int = 14
    gap_threshold: float = 0.0075  # >0.75% open gap flags event risk

    # ---- Strategy construction ------------------------------------------
    dte: int = 7                 # days-to-expiry assumed for weekly options
    risk_free_rate: float = 0.066
    # Short strikes placed at this many implied-sigma from spot.
    short_sigma: float = 1.0
    # Protective wing placed this many strike-steps beyond the short.
    wing_steps: int = 4
    # Stop-loss as a multiple of the credit collected (e.g. 2x credit).
    stop_loss_mult: float = 2.0
    # Take-profit: buy back at this fraction of credit remaining.
    take_profit_frac: float = 0.5

    # ---- Backtest -------------------------------------------------------
    entry_weekday: int = 3       # 0=Mon .. 3=Thu (weekly expiry day)
    slippage_per_leg: float = 0.5  # INR per option leg, per side
    cost_per_leg: float = 20.0     # brokerage+taxes per leg round-trip (INR)

    # ---- Volatility engine ---------------------------------------------
    hv_windows: tuple = (20, 30, 60, 90)   # realized-vol look-backs (days)
    iv_rank_lookback: int = 252            # 1Y window for IV rank/percentile

    # ---- Institutional risk limits (fractions of equity) ----------------
    weekly_loss_limit: float = 0.03
    monthly_loss_limit: float = 0.06
    kelly_fraction_cap: float = 0.25       # never bet more than 1/4 Kelly
    margin_per_lot: dict = field(default_factory=lambda: {
        # rough SPAN+exposure for a *defined-risk* spread, INR per lot
        "NIFTY": 22000.0, "BANKNIFTY": 28000.0,
    })
    max_margin_utilisation: float = 0.60   # cap deployed margin at 60% of equity
    vol_spike_block: float = 0.20          # block new trades if VIX jumps >20% d/d

    # ---- Data -----------------------------------------------------------
    data_dir: Path = DATA_DIR
    use_live: bool = True        # try live download first
    history_days: int = 600      # synthetic/look-back horizon
    seed: int = 7                # synthetic reproducibility

    @property
    def primary_instrument(self) -> Instrument:
        return self.instruments[self.primary]

    @classmethod
    def from_env(cls) -> "Config":
        """Allow lightweight overrides via environment variables."""
        cfg = cls()
        if v := os.getenv("QE_CAPITAL"):
            cfg.capital = float(v)
        if v := os.getenv("QE_RISK"):
            cfg.risk_per_trade = float(v)
        if v := os.getenv("QE_PRIMARY"):
            if v in cfg.instruments:
                cfg.primary = v
        if v := os.getenv("QE_USE_LIVE"):
            cfg.use_live = v.strip().lower() in ("1", "true", "yes", "on")
        return cfg


DEFAULT_CONFIG = Config()
