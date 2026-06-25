"""Performance analytics: institutional-grade trade/equity statistics."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd


def _max_drawdown(equity: pd.Series) -> tuple[float, int]:
    """Return (max_drawdown_fraction, recovery_days_for_worst_dd)."""
    if equity.empty:
        return 0.0, 0
    peak = equity.cummax()
    dd = (peak - equity) / peak
    max_dd = float(dd.max())
    # Recovery time: bars from the trough of the worst DD back to a new peak.
    trough_idx = int(dd.idxmax()) if dd.max() > 0 else 0
    peak_val = float(peak.iloc[trough_idx])
    recovery = 0
    for i in range(trough_idx, len(equity)):
        if equity.iloc[i] >= peak_val:
            recovery = i - trough_idx
            break
    else:
        recovery = -1  # not yet recovered
    return max_dd, recovery


def metrics(equity_df: pd.DataFrame, trade_log: pd.DataFrame,
            capital: float) -> dict:
    out: dict = {}
    if trade_log is None or trade_log.empty:
        return {"trades": 0, "note": "no trades"}

    pnl = trade_log["PnL"]
    wins = pnl[pnl > 0]
    losses = pnl[pnl <= 0]
    gross_win = float(wins.sum())
    gross_loss = float(abs(losses.sum()))
    n = len(pnl)
    win_rate = len(wins) / n
    avg_win = float(wins.mean()) if len(wins) else 0.0
    avg_loss = float(losses.mean()) if len(losses) else 0.0

    # Expectancy per trade (INR).
    expectancy = win_rate * avg_win + (1 - win_rate) * avg_loss

    # Daily equity returns for ratios.
    eq = equity_df.copy()
    eq["ret"] = eq["Equity"].pct_change().fillna(0.0)
    r = eq["ret"]
    ann = math.sqrt(252)
    sharpe = float(r.mean() / r.std() * ann) if r.std() > 0 else 0.0
    downside = r[r < 0]
    sortino = float(r.mean() / downside.std() * ann) if downside.std() > 0 else 0.0

    max_dd, recovery = _max_drawdown(eq["Equity"])

    # CAGR from equity span (assume ~252 trading days/yr).
    days = max(len(eq), 1)
    total_ret = eq["Equity"].iloc[-1] / capital - 1.0
    cagr = (1 + total_ret) ** (252 / days) - 1 if days > 1 else total_ret

    # Calmar = CAGR / MaxDD (the metric that matters for this mandate).
    calmar = float(cagr / max_dd) if max_dd > 0 else float("inf")

    out.update({
        "trades": n,
        "win_rate_pct": round(100 * win_rate, 1),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "expectancy_per_trade": round(expectancy, 2),
        "profit_factor": round(gross_win / gross_loss, 2) if gross_loss else float("inf"),
        "total_return_pct": round(100 * total_ret, 2),
        "cagr_pct": round(100 * cagr, 2),
        "sharpe": round(sharpe, 2),
        "sortino": round(sortino, 2),
        "max_drawdown_pct": round(100 * max_dd, 2),
        "calmar": round(calmar, 2) if calmar != float("inf") else "inf",
        "recovery_days": recovery,
        "final_equity": round(float(eq["Equity"].iloc[-1]), 2),
    })
    return out


def monthly_returns(equity_df: pd.DataFrame) -> pd.DataFrame:
    """Month-by-month return table from the equity curve."""
    eq = equity_df.copy()
    eq["Date"] = pd.to_datetime(eq["Date"])
    eq = eq.set_index("Date")
    m = eq["Equity"].resample("ME").last().pct_change().dropna() * 100
    return m.round(2).rename("Return%").to_frame()
