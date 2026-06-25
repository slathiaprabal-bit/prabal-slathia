"""Daily Decision Engine — ties every module into one institutional report.

Produces, for the latest bar:
  * volatility state (HV term structure, IV rank, expected move, P(in range))
  * 12-state market regime + trading policy
  * options positioning (max pain / PCR / GEX / S-R)  [synthetic OI caveat]
  * index rotation ranking
  * a single TRADE / NO-TRADE decision with confidence, strategy, size, risk

Macro inputs (global markets, US yields, FII/DII, events) are NOT auto-fetched
— they need a paid macro feed. They are surfaced as an explicit checklist the
operator fills, because ignoring them silently would be worse than flagging.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .config import Config
from .data import add_features, get_market_data, generate_synthetic
from .regimes import classify
from .risk import RiskEngine
from .signal import generate_signal, Strategy
from .volatility import compute_vol_state, surface_note
from .positioning import get_positioning


def _index_scores(config: Config) -> pd.DataFrame:
    """Rank tradable indices for option-selling suitability *today*.

    Score = weighted blend of IV-rank (premium richness), trend calmness
    (lower |trend| is better for neutral sellers), and a static liquidity tier.
    With only synthetic data we score the configured instruments; with a live
    multi-symbol feed this generalises to FINNIFTY/MIDCAP etc.
    """
    liquidity_tier = {"NIFTY": 1.0, "BANKNIFTY": 0.9, "FINNIFTY": 0.7,
                      "MIDCPNIFTY": 0.5, "NIFTYNXT50": 0.3}
    rows = []
    for name in config.instruments:
        cfg = Config()
        cfg.primary = name
        cfg.use_live = config.use_live
        cfg.seed = config.seed + hash(name) % 97
        try:
            df, _ = get_market_data(cfg)
        except Exception:
            df = add_features(generate_synthetic(cfg), cfg)
        vs = compute_vol_state(df, cfg)
        reg = classify(df, cfg, vs.iv_rank)
        liq = liquidity_tier.get(name, 0.4)
        iv_score = (vs.iv_rank if vs.iv_rank == vs.iv_rank else 50) / 100.0
        calm = max(0.0, 1.0 - abs(reg.trend_strength) / 3.0)
        tradeable = 1.0 if reg.policy.trade else 0.2
        score = 100 * (0.40 * iv_score + 0.25 * calm + 0.20 * liq + 0.15 * tradeable)
        rows.append({
            "Index": name, "Score": round(score, 1),
            "IV_Rank": vs.iv_rank, "Regime": reg.regime.value,
            "Trend(ATR)": reg.trend_strength, "Tradeable": reg.policy.trade,
            "Liquidity": liq,
        })
    return pd.DataFrame(rows).sort_values("Score", ascending=False).reset_index(drop=True)


@dataclass
class DailyDecision:
    date: str
    source: str
    vol_state: object
    regime: object
    positioning: object
    rotation: pd.DataFrame
    signal: object
    sizing: object
    trade: bool
    confidence: float


def build_decision(config: Config | None = None) -> DailyDecision:
    config = config or Config.from_env()
    df, source = get_market_data(config)
    row = df.dropna(subset=["MA", "ATR"]).iloc[-1]

    vs = compute_vol_state(df, config)
    reg = classify(df, config, vs.iv_rank)
    pos = get_positioning(df, config)
    rot = _index_scores(config)

    gap = float(row["Gap"]) if row["Gap"] == row["Gap"] else 0.0
    sig = generate_signal(row["Date"], float(row["Close"]), float(row["VIX"]),
                          float(row["MA"]), gap, config)

    risk = RiskEngine(config)
    sizing = risk.size(sig, regime_mult=reg.policy.size_mult, vix_chg_pct=reg.vix_chg)

    trade = bool(reg.policy.trade and sig.is_tradable and sizing.lots > 0)
    # Blend regime confidence with probability-of-profit proxy.
    conf = reg.confidence * (0.6 + 0.4 * vs.p_inside_1sigma) if trade else \
        min(reg.confidence, 100 - reg.confidence + 20)
    return DailyDecision(
        date=str(row["Date"])[:10], source=source, vol_state=vs, regime=reg,
        positioning=pos, rotation=rot, signal=sig, sizing=sizing,
        trade=trade, confidence=round(conf, 0),
    )


MACRO_CHECKLIST = [
    "Global cues: SGX/GIFT NIFTY, S&P futures, Asian indices",
    "US 10Y yield & DXY (dollar) direction",
    "Crude (Brent), Gold, USDINR",
    "FII / DII net cash + index-futures positioning (NSE provisional)",
    "Event calendar: RBI, Fed, CPI/IIP, expiry, Budget, results, elections",
]


def render(decision: DailyDecision, config: Config) -> str:
    vs, reg, pos, sizing, sig = (decision.vol_state, decision.regime,
                                 decision.positioning, decision.sizing, decision.signal)
    lot = config.primary_instrument.lot_size
    L = []
    add = L.append
    add("=" * 70)
    add(f"  DAILY DECISION ENGINE  |  {config.primary}  |  {decision.date}")
    add(f"  Data source: {decision.source.upper()}")
    add("=" * 70)

    add("\n  MACRO CHECKLIST  (operator-verified — not auto-fetched)")
    for item in MACRO_CHECKLIST:
        add(f"    [ ] {item}")

    add("\n  VOLATILITY")
    add(f"    Spot {vs.spot:,.1f} | {vs.summary()}")
    add(f"    HV term: " + " ".join(f"{w}d={vs.hv.get(w)}" for w in config.hv_windows))
    add(f"    IV percentile: {vs.iv_pctile} | Vol-risk-premium (IV-HV20): {vs.iv_minus_hv:+.1f}")
    add(f"    1σ range (to expiry): {vs.sigma1_lo:,.0f} – {vs.sigma1_hi:,.0f}  "
        f"(P inside ≈ {vs.p_inside_1sigma:.0%})")
    add(f"    2σ range: {vs.sigma2_lo:,.0f} – {vs.sigma2_hi:,.0f}")

    add("\n  REGIME")
    add(f"    {reg.regime.value}  (dir {reg.direction}, trend {reg.trend_strength} ATR, "
        f"VIXΔ {reg.vix_chg:+.1f}%, conf {reg.confidence:.0f})")
    add(f"    Policy: {'TRADE' if reg.policy.trade else 'NO-TRADE'} | "
        f"family {reg.policy.strategy_family} | size×{reg.policy.size_mult}")
    add(f"    Preferred: {', '.join(reg.policy.preferred) or '—'}")
    add(f"    {reg.policy.edge}")

    add("\n  POSITIONING  " + ("[SYNTHETIC OI — illustrative]" if pos.synthetic else "[LIVE]"))
    add(f"    Max Pain {pos.max_pain:,.0f} | PCR(OI) {pos.pcr_oi} | "
        f"Net GEX {pos.gex} (₹cr/pt) | Gamma flip {pos.gamma_flip}")
    add(f"    Support {pos.support} | Resistance {pos.resistance}")

    add("\n  INDEX ROTATION (option-selling suitability)")
    for _, r in decision.rotation.iterrows():
        add(f"    {r['Index']:<11} score {r['Score']:>5} | IVrank {r['IV_Rank']} | "
            f"{r['Regime']} | tradeable={r['Tradeable']}")

    add("\n  DECISION")
    add(f"    TRADE TODAY : {'YES' if decision.trade else 'NO'}   "
        f"(confidence {decision.confidence:.0f}%)")
    if decision.trade:
        add(f"    Strategy    : {sig.strategy.value}")
        if sig.short_put:
            add(f"    Short PUT   : {sig.short_put:,.0f}")
        if sig.short_call:
            add(f"    Short CALL  : {sig.short_call:,.0f}")
        add(f"    Credit      : {sig.credit:.1f} pts (₹{sig.credit * lot:,.0f}/lot) | "
            f"Max risk {sig.max_risk:.1f} pts")
        add(f"    Size        : {sizing.lots} lot(s) | capital@risk "
            f"₹{sizing.capital_at_risk:,.0f} | margin ₹{sizing.margin_used:,.0f}")
        add(f"    Sizing      : {sizing.reason}")
    else:
        reason = sizing.reason if not sig.is_tradable or sizing.lots == 0 else reg.policy.note
        add(f"    Reason      : {reason}")
    add("\n    " + surface_note())
    add("=" * 70)
    return "\n".join(L)
