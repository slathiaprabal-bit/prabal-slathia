"""Backtest / simulation engine.

Walks the daily history, opens a premium-selling structure on each weekly
expiry day, marks the position to market each day (Black-Scholes), and exits on
stop-loss, take-profit or expiry. Produces a trade log, an equity curve and a
performance report.

The same `recommend()` path is used for *live* recommendations (today's bar).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import List

import numpy as np
import pandas as pd

from .config import Config
from .data import get_market_data
from .pricing import bs_price
from .risk import RiskEngine
from .signal import Signal, Strategy, generate_signal


@dataclass
class Trade:
    Date: str
    Index: str
    VIX: float
    Regime: str
    Strategy: str
    Lots: int
    CE: float          # short call strike (0 if none)
    PE: float          # short put strike (0 if none)
    Credit: float      # per-lot-unit points received
    MaxRisk: float
    EntrySpot: float
    ExitDate: str
    ExitSpot: float
    ExitReason: str
    PnL: float         # rupees, net of costs
    Equity: float


def _structure_value(legs, spot, vix, t, rate) -> float:
    """Net cost to *close* the structure (buy back shorts, sell longs).

    Returns the debit required to flatten = sum(qty_to_close * price).
    Position PnL = entry_credit - close_debit (per unit).
    """
    val = 0.0
    for leg in legs:
        px = bs_price(spot, leg.strike, t, vix / 100.0, rate, leg.kind)
        # To close we take the opposite side: cost = -qty * price.
        val += -leg.qty * px
    return val  # this equals current net credit of the position


class Backtest:
    def __init__(self, config: Config):
        self.config = config
        self.risk = RiskEngine(config)
        self.trades: List[Trade] = []
        self.equity_curve: List[dict] = []

    # ------------------------------------------------------------------ #
    def run(self, df: pd.DataFrame) -> "Backtest":
        cfg = self.config
        lot = cfg.primary_instrument.lot_size
        name = cfg.primary
        rate = cfg.risk_free_rate

        df = df.dropna(subset=["MA", "ATR"]).reset_index(drop=True)
        i = 0
        n = len(df)
        while i < n:
            row = df.iloc[i]
            self.risk.reset_day()
            is_entry = pd.Timestamp(row["Date"]).weekday() == cfg.entry_weekday

            if is_entry:
                sig = generate_signal(row["Date"], float(row["Close"]),
                                      float(row["VIX"]), float(row["MA"]),
                                      float(row["Gap"]) if not math.isnan(row["Gap"]) else 0.0,
                                      cfg)
                sizing = self.risk.size(sig)
                if sizing.lots > 0:
                    trade = self._simulate_trade(df, i, sig, sizing.lots, lot, rate, name)
                    self.trades.append(trade)
                    # jump to exit bar to avoid overlapping positions
                    i = self._find_index(df, trade.ExitDate, i)

            self.equity_curve.append({
                "Date": pd.Timestamp(row["Date"]),
                "Equity": self.risk.equity,
                "Drawdown": self.risk.drawdown,
            })
            i += 1
        return self

    # ------------------------------------------------------------------ #
    def _simulate_trade(self, df, entry_idx, sig: Signal, lots, lot, rate, name) -> Trade:
        cfg = self.config
        entry = df.iloc[entry_idx]
        entry_credit = sig.credit
        sl_level = entry_credit * cfg.stop_loss_mult          # loss cap (points)
        tp_level = entry_credit * (1 - cfg.take_profit_frac)  # buy-back target

        exit_reason, exit_idx = "EXPIRY", entry_idx
        # walk forward up to dte calendar days / available bars
        for j in range(entry_idx + 1, len(df)):
            bar = df.iloc[j]
            days_left = max((pd.Timestamp(sig.date) + pd.Timedelta(days=cfg.dte)
                             - pd.Timestamp(bar["Date"])).days, 0)
            t = days_left / 365.0
            cur_credit = _structure_value(sig.legs, float(bar["Close"]),
                                          float(bar["VIX"]), t, rate)
            # PnL per unit so far = entry_credit - cur_credit
            pnl_unit = entry_credit - cur_credit
            exit_idx = j
            if cur_credit <= tp_level:
                exit_reason = "TAKE_PROFIT"; break
            if -pnl_unit >= sl_level:
                exit_reason = "STOP_LOSS"; break
            if days_left <= 0:
                exit_reason = "EXPIRY"; break

        exit_bar = df.iloc[exit_idx]
        days_left = max((pd.Timestamp(sig.date) + pd.Timedelta(days=cfg.dte)
                         - pd.Timestamp(exit_bar["Date"])).days, 0)
        t = days_left / 365.0
        close_credit = _structure_value(sig.legs, float(exit_bar["Close"]),
                                        float(exit_bar["VIX"]), t, rate)
        pnl_unit = entry_credit - close_credit

        n_legs = len(sig.legs)
        costs = (cfg.cost_per_leg + cfg.slippage_per_leg) * n_legs * lots
        pnl = pnl_unit * lot * lots - costs

        self.risk.update_equity(pnl)

        return Trade(
            Date=str(pd.Timestamp(sig.date).date()),
            Index=name,
            VIX=round(sig.vix, 2),
            Regime=sig.regime.value,
            Strategy=sig.strategy.value,
            Lots=lots,
            CE=sig.short_call or 0.0,
            PE=sig.short_put or 0.0,
            Credit=round(entry_credit, 2),
            MaxRisk=round(sig.max_risk, 2),
            EntrySpot=round(sig.spot, 2),
            ExitDate=str(pd.Timestamp(exit_bar["Date"]).date()),
            ExitSpot=round(float(exit_bar["Close"]), 2),
            ExitReason=exit_reason,
            PnL=round(pnl, 2),
            Equity=round(self.risk.equity, 2),
        )

    @staticmethod
    def _find_index(df, date_str, default):
        m = df.index[df["Date"].astype("datetime64[ns]") == pd.Timestamp(date_str)]
        return int(m[0]) if len(m) else default

    # ------------------------------------------------------------------ #
    def trade_log(self) -> pd.DataFrame:
        return pd.DataFrame([asdict(t) for t in self.trades])

    def equity_df(self) -> pd.DataFrame:
        return pd.DataFrame(self.equity_curve)

    def performance(self) -> dict:
        tl = self.trade_log()
        eq = self.equity_df()
        cfg = self.config
        if tl.empty:
            return {"trades": 0, "note": "no trades generated"}

        wins = tl[tl["PnL"] > 0]["PnL"]
        losses = tl[tl["PnL"] <= 0]["PnL"]
        gross_win = wins.sum()
        gross_loss = abs(losses.sum())
        total_pnl = tl["PnL"].sum()

        # Daily equity returns for Sharpe.
        eq = eq.copy()
        eq["ret"] = eq["Equity"].pct_change().fillna(0.0)
        ann = math.sqrt(252)
        sharpe = (eq["ret"].mean() / eq["ret"].std() * ann) if eq["ret"].std() > 0 else 0.0
        max_dd = eq["Drawdown"].max() if "Drawdown" in eq else 0.0

        return {
            "source_capital": cfg.capital,
            "final_equity": round(self.risk.equity, 2),
            "total_return_pct": round(100 * total_pnl / cfg.capital, 2),
            "total_pnl": round(total_pnl, 2),
            "trades": int(len(tl)),
            "win_rate_pct": round(100 * len(wins) / len(tl), 1),
            "avg_win": round(wins.mean(), 2) if len(wins) else 0.0,
            "avg_loss": round(losses.mean(), 2) if len(losses) else 0.0,
            "profit_factor": round(gross_win / gross_loss, 2) if gross_loss > 0 else float("inf"),
            "max_drawdown_pct": round(100 * max_dd, 2),
            "sharpe": round(sharpe, 2),
        }


# ---------------------------------------------------------------------- #
# Live recommendation (today's bar)
# ---------------------------------------------------------------------- #
def recommend(config: Config, df: pd.DataFrame):
    """Generate the signal + position size for the most recent bar."""
    row = df.dropna(subset=["MA", "ATR"]).iloc[-1]
    sig = generate_signal(row["Date"], float(row["Close"]), float(row["VIX"]),
                          float(row["MA"]),
                          float(row["Gap"]) if not math.isnan(row["Gap"]) else 0.0,
                          config)
    risk = RiskEngine(config)
    sizing = risk.size(sig)
    return sig, sizing


def run_full(config: Config | None = None):
    """Convenience: load data, backtest, return (df, source, bt, sig, sizing)."""
    config = config or Config.from_env()
    df, source = get_market_data(config)
    bt = Backtest(config).run(df)
    sig, sizing = recommend(config, df)
    return df, source, bt, sig, sizing
