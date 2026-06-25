"""Risk engine: position sizing, drawdown throttle and daily loss limits.

Sizing is risk-based: lots are chosen so that the structure's worst-case loss
(max_risk * lot_size) consumes no more than `risk_per_trade` of current equity,
then scaled down by a drawdown multiplier.
"""

from __future__ import annotations

from dataclasses import dataclass

from .config import Config
from .signal import Signal


@dataclass
class SizingResult:
    lots: int
    capital_at_risk: float
    multiplier: float
    reason: str


class RiskEngine:
    def __init__(self, config: Config):
        self.config = config
        self.equity = config.capital
        self.peak_equity = config.capital
        self.day_pnl = 0.0

    # -- equity / drawdown bookkeeping ------------------------------------
    def update_equity(self, pnl: float) -> None:
        self.equity += pnl
        self.day_pnl += pnl
        self.peak_equity = max(self.peak_equity, self.equity)

    def reset_day(self) -> None:
        self.day_pnl = 0.0

    @property
    def drawdown(self) -> float:
        if self.peak_equity <= 0:
            return 0.0
        return max(0.0, (self.peak_equity - self.equity) / self.peak_equity)

    def _throttle(self) -> float:
        """Size multiplier based on current drawdown (worst breached band)."""
        mult = 1.0
        for threshold, m in sorted(self.config.drawdown_throttle.items()):
            if self.drawdown >= threshold:
                mult = m
        return mult

    # -- sizing -----------------------------------------------------------
    def size(self, signal: Signal) -> SizingResult:
        cfg = self.config
        lot = cfg.primary_instrument.lot_size

        if not signal.is_tradable:
            return SizingResult(0, 0.0, 0.0, "signal not tradable")

        # Daily loss circuit-breaker.
        if self.day_pnl <= -cfg.daily_loss_limit * self.equity:
            return SizingResult(0, 0.0, 0.0, "daily loss limit hit")

        mult = self._throttle()
        if mult <= 0:
            return SizingResult(0, 0.0, 0.0, f"drawdown {self.drawdown:.0%} > limit")

        risk_budget = self.equity * cfg.risk_per_trade * mult
        risk_per_lot = signal.max_risk * lot
        if risk_per_lot <= 0:
            return SizingResult(0, 0.0, mult, "non-positive risk per lot")

        lots = int(risk_budget // risk_per_lot)
        lots = max(0, min(lots, cfg.max_lots))

        # Enforce the hard cap on capital-at-risk.
        cap = self.equity * cfg.max_risk_per_trade
        while lots > 0 and lots * risk_per_lot > cap:
            lots -= 1

        if lots == 0:
            return SizingResult(0, 0.0, mult, "risk budget < one lot")

        return SizingResult(
            lots=lots,
            capital_at_risk=round(lots * risk_per_lot, 2),
            multiplier=mult,
            reason=f"risk {cfg.risk_per_trade:.1%}*{mult:.2f} of "
                   f"₹{self.equity:,.0f}",
        )
