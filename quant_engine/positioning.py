"""Options-positioning engine: Max Pain, PCR, OI build-up, GEX, S/R zones.

================================  CAVEAT  ================================
These metrics REQUIRE a live NSE option chain with per-strike Open Interest.
yfinance / Yahoo does not provide Indian OI. `nse_chain.py` now fetches the
real NSE index option-chain (gated on config.use_live_chain); when it is
unreachable (offline, blocked egress, throttling) this module falls back to a
*synthetic* OI profile (a plausible double-humped distribution around spot) so
the math and dashboard always run. Treat the numbers as ILLUSTRATIVE, not
tradable, when `synthetic=True`.

Max Pain in particular is a weak predictor: it is descriptive of current
positioning, not causal, and pinning only tends to assert itself very close to
expiry. Never size a trade on Max Pain alone.
=========================================================================

Live path: `nse_chain.nearest_expiry_frame(symbol)` returns the front-expiry
chain [Strike, CE_OI, PE_OI, CE_IV, PE_IV, _t] from the NSE API, which
`analyze_chain()` consumes directly. Swap in a paid vendor by reimplementing
that one function.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

import numpy as np
import pandas as pd

from .config import Config
from .pricing import bs_price


@dataclass
class Positioning:
    synthetic: bool
    spot: float
    max_pain: float
    pcr_oi: float
    support: List[float] = field(default_factory=list)
    resistance: List[float] = field(default_factory=list)
    gex: float = 0.0               # net dealer gamma exposure (sign convention below)
    gamma_flip: float = float("nan")
    note: str = ""


def build_synthetic_chain(spot: float, vix: float, config: Config) -> pd.DataFrame:
    """Plausible OI profile: puts cluster below spot, calls above (typical)."""
    step = config.primary_instrument.strike_step
    atm = round(spot / step) * step
    strikes = np.arange(atm - 15 * step, atm + 15 * step + step, step)
    em = spot * (vix / 100.0) * np.sqrt(config.dte / 365.0)

    rng = np.random.default_rng(config.seed)
    # OI humps: puts peak ~1 EM below, calls ~1 EM above.
    pe_oi = 1e5 * np.exp(-((strikes - (spot - em)) ** 2) / (2 * (em * 0.9) ** 2))
    ce_oi = 1e5 * np.exp(-((strikes - (spot + em)) ** 2) / (2 * (em * 0.9) ** 2))
    pe_oi *= rng.uniform(0.8, 1.2, len(strikes))
    ce_oi *= rng.uniform(0.8, 1.2, len(strikes))

    t = config.dte / 365.0
    return pd.DataFrame({
        "Strike": strikes,
        "CE_OI": ce_oi.round().astype(int),
        "PE_OI": pe_oi.round().astype(int),
        "CE_IV": vix, "PE_IV": vix,
        "_t": t,
    })


def _gamma(spot, strike, t, vol, rate=0.066):
    """BS gamma (per 1 unit underlying)."""
    import math
    if t <= 0 or vol <= 0:
        return 0.0
    d1 = (math.log(spot / strike) + (rate + 0.5 * vol * vol) * t) / (vol * math.sqrt(t))
    pdf = math.exp(-0.5 * d1 * d1) / math.sqrt(2 * math.pi)
    return pdf / (spot * vol * math.sqrt(t))


def max_pain(chain: pd.DataFrame) -> float:
    """Strike at which total intrinsic payout to option HOLDERS is minimised
    (i.e. where option writers lose the least) given current OI."""
    strikes = chain["Strike"].to_numpy(dtype=float)
    ce_oi = chain["CE_OI"].to_numpy(dtype=float)
    pe_oi = chain["PE_OI"].to_numpy(dtype=float)
    pain = []
    for K in strikes:
        # At expiry price K: calls with strike<K pay (K-strike)*OI to holders;
        # puts with strike>K pay (strike-K)*OI. Writers lose that total.
        call_loss = np.sum(np.maximum(K - strikes, 0.0) * ce_oi)
        put_loss = np.sum(np.maximum(strikes - K, 0.0) * pe_oi)
        pain.append(call_loss + put_loss)
    return float(strikes[int(np.argmin(pain))])


def analyze_chain(chain: pd.DataFrame, spot: float, config: Config,
                  synthetic: bool) -> Positioning:
    mp = max_pain(chain)
    total_pe = chain["PE_OI"].sum()
    total_ce = chain["CE_OI"].sum()
    pcr = round(total_pe / total_ce, 2) if total_ce else float("nan")

    # Support = strikes with the largest PUT OI below spot; resistance = largest CALL OI above.
    below = chain[chain["Strike"] < spot].nlargest(3, "PE_OI")["Strike"].tolist()
    above = chain[chain["Strike"] > spot].nlargest(3, "CE_OI")["Strike"].tolist()

    # GEX (dealer-short-gamma convention): dealers typically short calls / long puts
    # vs customers. We approximate net gamma exposure = sum gamma*OI*(call - put).
    t = float(chain["_t"].iloc[0]) if "_t" in chain else config.dte / 365.0
    gex = 0.0
    gflip = float("nan")
    contract = config.primary_instrument.lot_size
    profile = []
    for _, r in chain.iterrows():
        g = _gamma(spot, float(r["Strike"]), t, float(r["CE_IV"]) / 100.0)
        node = g * (float(r["CE_OI"]) - float(r["PE_OI"])) * contract * spot
        gex += node
        profile.append((float(r["Strike"]), node))
    # Gamma flip ~ strike where cumulative GEX crosses zero.
    cum = 0.0
    for K, node in profile:
        prev = cum
        cum += node
        if prev < 0 <= cum or prev > 0 >= cum:
            gflip = K
            break

    note = ("SYNTHETIC OI — illustrative only; wire a live NSE chain for tradable "
            "positioning." if synthetic else "Live NSE chain.")
    return Positioning(
        synthetic=synthetic, spot=round(spot, 1), max_pain=round(mp, 1),
        pcr_oi=pcr, support=sorted(below), resistance=sorted(above),
        gex=round(gex / 1e7, 2), gamma_flip=gflip, note=note,
    )


def get_positioning(df: pd.DataFrame, config: Config) -> Positioning:
    """Entry point. Tries a live chain loader; falls back to synthetic OI."""
    row = df.iloc[-1]
    spot, vix = float(row["Close"]), float(row["VIX"])
    chain = load_live_chain(config)
    synthetic = chain is None
    if synthetic:
        chain = build_synthetic_chain(spot, vix, config)
    return analyze_chain(chain, spot, config, synthetic)


def load_live_chain(config: Config):
    """Real NSE option-chain feed (front expiry).

    Returns a DataFrame [Strike, CE_OI, PE_OI, CE_IV, PE_IV, _t] from the live
    NSE chain, or None (which triggers the synthetic fallback). Gated on
    config.use_live and config.use_live_chain so offline/synthetic runs never
    touch the network.
    """
    if not (getattr(config, "use_live", True) and getattr(config, "use_live_chain", True)):
        return None
    try:
        from .nse_chain import nearest_expiry_frame
        return nearest_expiry_frame(config.primary)
    except Exception:
        return None
