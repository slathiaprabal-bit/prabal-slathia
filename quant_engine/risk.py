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
    margin_used: float = 0.0
    kelly_lots: int = 0


def kelly_fraction(win_rate: float, avg_win: float, avg_loss: float) -> float:
    """Fraction of capital Kelly would bet, given edge stats.

    f* = W/L_ratio formulation: f = p - (1-p)/b, where b = avg_win/|avg_loss|.
    Returns 0 if no positive edge. Always to be scaled DOWN (fractional Kelly).
    """
    if avg_loss == 0 or avg_win <= 0:
        return 0.0
    b = avg_win / abs(avg_loss)
    p = win_rate
    f = p - (1 - p) / b
    return max(0.0, f)


def adaptive_risk_fraction(config: Config, confidence: float, iv_rank: float,
                           size_mult: float, drawdown: float) -> tuple[float, str]:
    """Blend survival-first and opportunistic sizing into one risk fraction.

    Returns (fraction, rationale). Logic:
      * start at the conservative base (risk_per_trade)
      * lean IN when conviction (regime confidence) AND premium (IV rank) are
        both high — that is where a premium-seller's edge is real
      * lean OUT in drawdown and when the regime policy says size down
      * always clamp to [risk_floor, risk_ceiling]
    """
    if not config.adaptive_risk:
        return config.risk_per_trade, "fixed risk"

    base = config.risk_per_trade
    conv = max(0.0, min(1.0, confidence / 100.0))
    ivr = max(0.0, min(1.0, (iv_rank if iv_rank == iv_rank else 50.0) / 100.0))

    # Opportunity score in [0,1]: needs BOTH conviction and rich premium.
    opportunity = (0.6 * conv + 0.4 * ivr) * (0.5 + 0.5 * ivr)
    # Scale between floor and ceiling, then apply regime + drawdown brakes.
    frac = config.risk_floor + (config.risk_ceiling - config.risk_floor) * opportunity
    frac *= size_mult                       # regime policy multiplier
    frac *= max(0.0, 1.0 - 2.0 * drawdown)  # cut hard as equity bleeds
    frac = max(config.risk_floor * 0.5, min(config.risk_ceiling, frac))

    tag = "LEAN-IN" if frac > base else "SURVIVAL"
    return frac, (f"{tag}: risk {frac:.1%} (conv {confidence:.0f}, "
                  f"IVr {ivr*100:.0f}, regime×{size_mult:.2f})")


class RiskEngine:
    def __init__(self, config: Config):
        self.config = config
        self.equity = config.capital
        self.peak_equity = config.capital
        self.day_pnl = 0.0
        self.week_pnl = 0.0
        self.month_pnl = 0.0
        # Optional edge stats (win_rate, avg_win, avg_loss) for Kelly sizing.
        self.edge_stats: tuple | None = None

    # -- equity / drawdown bookkeeping ------------------------------------
    def update_equity(self, pnl: float) -> None:
        self.equity += pnl
        self.day_pnl += pnl
        self.week_pnl += pnl
        self.month_pnl += pnl
        self.peak_equity = max(self.peak_equity, self.equity)

    def reset_day(self) -> None:
        self.day_pnl = 0.0

    def reset_week(self) -> None:
        self.week_pnl = 0.0

    def reset_month(self) -> None:
        self.month_pnl = 0.0

    # -- no-trade conditions ---------------------------------------------
    def blocking_reason(self, vix_chg_pct: float | None = None) -> str | None:
        """Hard circuit-breakers checked before any sizing."""
        cfg = self.config
        if self.day_pnl <= -cfg.daily_loss_limit * self.equity:
            return f"daily loss limit ({cfg.daily_loss_limit:.0%}) hit"
        if self.week_pnl <= -cfg.weekly_loss_limit * self.equity:
            return f"weekly loss limit ({cfg.weekly_loss_limit:.0%}) hit"
        if self.month_pnl <= -cfg.monthly_loss_limit * self.equity:
            return f"monthly loss limit ({cfg.monthly_loss_limit:.0%}) hit"
        if vix_chg_pct is not None and vix_chg_pct >= cfg.vol_spike_block * 100:
            return f"vol spike (VIX +{vix_chg_pct:.0f}%): short-gamma blackout"
        return None

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
    def size(self, signal: Signal, regime_mult: float = 1.0,
             vix_chg_pct: float | None = None,
             risk_fraction: float | None = None) -> SizingResult:
        cfg = self.config
        lot = cfg.primary_instrument.lot_size

        if not signal.is_tradable:
            return SizingResult(0, 0.0, 0.0, "signal not tradable")

        blocked = self.blocking_reason(vix_chg_pct)
        if blocked:
            return SizingResult(0, 0.0, 0.0, blocked)

        mult = self._throttle() * regime_mult
        if mult <= 0:
            return SizingResult(0, 0.0, 0.0,
                                f"drawdown {self.drawdown:.0%} or regime blocks trade")

        # Adaptive fraction already folds in regime_mult; otherwise apply it here.
        if risk_fraction is not None:
            risk_budget = self.equity * risk_fraction
        else:
            risk_budget = self.equity * cfg.risk_per_trade * mult
        risk_per_lot = signal.max_risk * lot
        if risk_per_lot <= 0:
            return SizingResult(0, 0.0, mult, "non-positive risk per lot")

        lots = int(risk_budget // risk_per_lot)

        # Kelly overlay: cap lots at fractional-Kelly when edge stats exist.
        kelly_lots = lots
        if self.edge_stats:
            wr, aw, al = self.edge_stats
            f = kelly_fraction(wr, aw, al) * cfg.kelly_fraction_cap
            kelly_budget = self.equity * f
            kelly_lots = int(kelly_budget // risk_per_lot)
            lots = min(lots, kelly_lots) if kelly_lots > 0 else lots

        lots = max(0, min(lots, cfg.max_lots))

        # Hard cap on capital-at-risk.
        cap = self.equity * cfg.max_risk_per_trade
        while lots > 0 and lots * risk_per_lot > cap:
            lots -= 1

        # Margin ceiling.
        margin_lot = cfg.margin_per_lot.get(cfg.primary, 25000.0)
        margin_cap = self.equity * cfg.max_margin_utilisation
        while lots > 0 and lots * margin_lot > margin_cap:
            lots -= 1

        if lots == 0:
            return SizingResult(0, 0.0, mult,
                                "budget/margin < one lot at this risk")

        if risk_fraction is not None:
            reason = f"adaptive risk {risk_fraction:.2%} of ₹{self.equity:,.0f}"
        else:
            reason = f"risk {cfg.risk_per_trade:.1%}*{mult:.2f} of ₹{self.equity:,.0f}"
        return SizingResult(
            lots=lots,
            capital_at_risk=round(lots * risk_per_lot, 2),
            multiplier=round(mult, 2),
            reason=reason,
            margin_used=round(lots * margin_lot, 2),
            kelly_lots=kelly_lots,
        )
