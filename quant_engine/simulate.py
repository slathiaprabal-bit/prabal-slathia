"""Monte-Carlo survival simulation.

For a capital-preservation mandate the question that matters is not "what's the
average return" but "what's my probability of ruin / large drawdown over the
next N trades". This module bootstraps from the backtest's per-trade PnL
distribution and resamples thousands of trade sequences to estimate:

  * probability of ruin (equity falling below a ruin threshold)
  * distribution of maximum drawdown
  * percentiles of final equity / monthly return

Bootstrapping preserves the *real* fat left tail of premium selling (a few big
losses among many small wins), which parametric (normal) assumptions hide.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class RuinResult:
    paths: int
    trades_per_path: int
    start_capital: float
    ruin_threshold: float
    p_ruin: float
    p_dd_gt_10: float
    p_dd_gt_20: float
    median_final: float
    p05_final: float
    p95_final: float
    median_max_dd: float
    worst_max_dd: float
    median_total_return_pct: float

    def render(self) -> str:
        return "\n".join([
            "=" * 60,
            "  MONTE-CARLO SURVIVAL SIMULATION",
            "=" * 60,
            f"  Paths              : {self.paths:,}  ({self.trades_per_path} trades each)",
            f"  Start capital      : ₹{self.start_capital:,.0f}",
            f"  Ruin threshold     : ₹{self.ruin_threshold:,.0f}",
            "-" * 60,
            f"  P(ruin)            : {self.p_ruin:.2%}",
            f"  P(max DD > 10%)    : {self.p_dd_gt_10:.2%}",
            f"  P(max DD > 20%)    : {self.p_dd_gt_20:.2%}",
            "-" * 60,
            f"  Median max DD      : {self.median_max_dd:.2%}",
            f"  Worst-case max DD  : {self.worst_max_dd:.2%}",
            f"  Final equity  5th  : ₹{self.p05_final:,.0f}",
            f"               50th  : ₹{self.median_final:,.0f}",
            f"               95th  : ₹{self.p95_final:,.0f}",
            f"  Median total return: {self.median_total_return_pct:+.1f}%",
            "=" * 60,
        ])


def monte_carlo_ruin(trade_pnls: np.ndarray, start_capital: float,
                     trades_per_path: int = 50, paths: int = 5000,
                     ruin_fraction: float = 0.5, seed: int = 7) -> RuinResult:
    """Bootstrap trade sequences and measure survival statistics.

    trade_pnls       : array of historical per-trade PnL (INR)
    trades_per_path  : horizon (e.g. ~50 weekly trades ≈ 1 year)
    ruin_fraction    : ruin = equity falls below this fraction of start capital
    """
    trade_pnls = np.asarray(trade_pnls, dtype=float)
    trade_pnls = trade_pnls[~np.isnan(trade_pnls)]
    if len(trade_pnls) == 0:
        raise ValueError("no trade PnLs to simulate from")

    rng = np.random.default_rng(seed)
    ruin_threshold = start_capital * ruin_fraction

    finals = np.empty(paths)
    max_dds = np.empty(paths)
    ruined = np.zeros(paths, dtype=bool)

    for p in range(paths):
        draws = rng.choice(trade_pnls, size=trades_per_path, replace=True)
        equity = start_capital + np.cumsum(draws)
        equity = np.insert(equity, 0, start_capital)
        peak = np.maximum.accumulate(equity)
        dd = (peak - equity) / peak
        max_dds[p] = dd.max()
        finals[p] = equity[-1]
        ruined[p] = equity.min() <= ruin_threshold

    return RuinResult(
        paths=paths, trades_per_path=trades_per_path,
        start_capital=start_capital, ruin_threshold=ruin_threshold,
        p_ruin=float(ruined.mean()),
        p_dd_gt_10=float((max_dds > 0.10).mean()),
        p_dd_gt_20=float((max_dds > 0.20).mean()),
        median_final=float(np.median(finals)),
        p05_final=float(np.percentile(finals, 5)),
        p95_final=float(np.percentile(finals, 95)),
        median_max_dd=float(np.median(max_dds)),
        worst_max_dd=float(max_dds.max()),
        median_total_return_pct=float(100 * (np.median(finals) / start_capital - 1)),
    )


def run_simulation(config, trades_per_path: int = 50, paths: int = 5000) -> RuinResult:
    """Convenience: backtest then Monte-Carlo the resulting trade PnLs."""
    from .engine import Backtest
    from .data import get_market_data
    df, _ = get_market_data(config)
    bt = Backtest(config).run(df)
    tl = bt.trade_log()
    if tl.empty:
        raise ValueError("backtest produced no trades to simulate "
                         "(capital too small for one lot at current risk caps)")
    return monte_carlo_ruin(tl["PnL"].to_numpy(), config.capital,
                            trades_per_path=trades_per_path, paths=paths,
                            seed=config.seed)
