"""Serialize quant-engine outputs into the terminal's Snapshot schema.

Every value here comes from the existing, untouched engine modules
(`build_decision`, `surface_dashboard.build_surface`, `positioning`,
`nse_chain`, `simulate`/`engine` backtest). This file only *reshapes* those
outputs for the React/Three.js front end — no trading logic lives here.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np

from quant_engine.config import Config
from quant_engine.report import build_decision
from quant_engine.surface_dashboard import build_surface
from quant_engine.positioning import build_synthetic_chain
from quant_engine.regimes import MarketRegime

from .greeks import position_greeks
from .instrument import Probe
from .strategy_engine import MarketConditions, rank_strategies
from .volhistory import record_and_derive


# 12 engine regimes -> 6 UI states the spec asks for.
_REGIME_UI = {
    MarketRegime.STRONG_BULL: "TRENDING_UP", MarketRegime.SLOW_BULL: "TRENDING_UP",
    MarketRegime.ACCUMULATION: "TRENDING_UP", MarketRegime.RECOVERY: "TRENDING_UP",
    MarketRegime.STRONG_BEAR: "TRENDING_DOWN", MarketRegime.SLOW_BEAR: "TRENDING_DOWN",
    MarketRegime.DISTRIBUTION: "TRENDING_DOWN",
    MarketRegime.SIDEWAYS_HIGH_VOL: "VOLATILE", MarketRegime.COMPRESSION: "NORMAL",
    MarketRegime.SIDEWAYS_LOW_VOL: "NORMAL",
    MarketRegime.EXPANSION: "EVENT_RISK", MarketRegime.PANIC: "NO_GO",
}


def _ui_regime(reg) -> str:
    state = _REGIME_UI.get(reg.regime, "NORMAL")
    if not reg.policy.trade and state not in ("NO_GO", "EVENT_RISK", "VOLATILE"):
        state = "NO_GO"
    return state


def _chain_rows(cfg: Config, spot: float, vix: float):
    """Live NSE chain if reachable, else synthetic profile (labelled)."""
    synthetic = True
    try:
        from quant_engine.nse_chain import nearest_expiry_frame
        fr = nearest_expiry_frame(cfg.primary) if (cfg.use_live and cfg.use_live_chain) else None
        if fr is not None and len(fr):
            synthetic = False
    except Exception:
        fr = None
    if fr is None:
        fr = build_synthetic_chain(spot, vix, cfg)
    rows = []
    for _, r in fr.iterrows():
        rows.append({
            "strike": float(r["Strike"]),
            "ceOI": float(r.get("CE_OI", 0) or 0),
            "peOI": float(r.get("PE_OI", 0) or 0),
            "ceIV": float(r.get("CE_IV", vix) or vix),
            "peIV": float(r.get("PE_IV", vix) or vix),
        })
    rows.sort(key=lambda x: x["strike"])
    return rows, synthetic


def montecarlo(cfg: Config, probe: Probe | None = None) -> dict:
    """Bootstrap the backtest's per-trade PnL into ruin / drawdown views.

    Mirrors simulate.py's resampling for *visualisation only* (histogram,
    percentile cone) — the canonical numbers still come from the engine.
    """
    probe = probe or Probe()
    from quant_engine.engine import Backtest
    from quant_engine.data import get_market_data
    probe.mark("mc.backtest", capital=cfg.capital, seed=cfg.seed)
    try:
        df, _ = get_market_data(cfg)
        tl = Backtest(cfg).run(df).trade_log()
        pnls = tl["PnL"].to_numpy(dtype=float) if not tl.empty else np.array([0.0])
    except Exception:
        pnls = np.array([0.0])

    probe.mark("mc.bootstrap", n_pnls=len(pnls),
               pnl_min=float(np.min(pnls)), pnl_max=float(np.max(pnls)),
               pnl_mean=float(np.mean(pnls)))
    rng = np.random.default_rng(cfg.seed)
    n, paths, start = 50, 4000, cfg.capital
    finals = np.empty(paths)
    max_dd = np.empty(paths)
    equity_paths = np.empty((paths, n + 1))
    for p in range(paths):
        draws = rng.choice(pnls, size=n, replace=True)
        eq = start + np.concatenate([[0], np.cumsum(draws)])
        peak = np.maximum.accumulate(eq)
        equity_paths[p] = eq
        max_dd[p] = ((peak - eq) / peak).max()
        finals[p] = eq[-1]

    ruin_thr = start * 0.5
    ret_pct = 100 * (finals / start - 1.0)
    hist, edges = np.histogram(ret_pct, bins=32)
    # Drawdown cone: percentile bands of the equity path through time.
    cone = {
        "p05": np.percentile(equity_paths, 5, axis=0).round(0).tolist(),
        "p50": np.percentile(equity_paths, 50, axis=0).round(0).tolist(),
        "p95": np.percentile(equity_paths, 95, axis=0).round(0).tolist(),
    }
    return {
        "startCapital": start,
        "pRuin": float((finals <= ruin_thr).mean()),
        "pDD10": float((max_dd > 0.10).mean()),
        "pDD20": float((max_dd > 0.20).mean()),
        "medianMaxDD": float(np.median(max_dd)),
        "worstMaxDD": float(max_dd.max()),
        "expectedDrawdown": float(np.mean(max_dd)),
        "finalP05": float(np.percentile(finals, 5)),
        "finalP50": float(np.percentile(finals, 50)),
        "finalP95": float(np.percentile(finals, 95)),
        "medianReturnPct": float(np.median(ret_pct)),
        "hist": {"counts": hist.tolist(),
                 "edges": edges.round(2).tolist()},
        "cone": cone,
        "samplePaths": equity_paths[:24].round(0).tolist(),
    }


# Downsampled price/vol history for the frontend Hidden-Markov regime engine.
# Memoised + refreshed every `every` calls so the 2s stream stays light.
_HIST_CACHE: dict = {"n": 0, "data": None}


def _history(cfg: Config, every: int = 30) -> dict:
    c = _HIST_CACHE
    if c["data"] is None or c["n"] % every == 0:
        try:
            from quant_engine.data import get_market_data
            df, _ = get_market_data(cfg)
            close = df["Close"].to_numpy(dtype=float)
            rets = np.diff(np.log(close)) * 100.0
            vix = (df["VIX"].to_numpy(dtype=float)[1:] if "VIX" in df.columns
                   else np.full(len(rets), float("nan")))
            n = min(len(rets), 180)
            c["data"] = {
                "returns": [round(float(x), 3) for x in rets[-n:]],
                "vix": [round(float(x), 2) for x in vix[-n:]],
            }
        except Exception:
            c["data"] = {"returns": [], "vix": []}
    c["n"] += 1
    return c["data"]


# Historical backtest result (equity curve + performance) for the frontend
# backtesting view. Memoised — the backtest is historical, not tick-varying.
_BT_CACHE: dict = {"n": 0, "data": None}


def _backtest(cfg: Config, every: int = 60) -> dict:
    c = _BT_CACHE
    if c["data"] is None or c["n"] % every == 0:
        try:
            from quant_engine.engine import Backtest
            from quant_engine.data import get_market_data
            df, _ = get_market_data(cfg)
            bt = Backtest(cfg).run(df)
            perf = bt.performance()
            eq = bt.equity_df()
            n = len(eq)
            step = max(1, n // 120)
            curve = [
                {"equity": round(float(eq.iloc[k]["Equity"]), 0),
                 "drawdown": round(float(eq.iloc[k].get("Drawdown", 0.0)), 4)}
                for k in range(0, n, step)
            ]
            c["data"] = {
                "stats": {
                    "totalReturnPct": perf.get("total_return_pct"),
                    "totalPnl": perf.get("total_pnl"),
                    "trades": perf.get("trades"),
                    "winRatePct": perf.get("win_rate_pct"),
                    "profitFactor": perf.get("profit_factor"),
                    "maxDrawdownPct": perf.get("max_drawdown_pct"),
                    "sharpe": perf.get("sharpe"),
                    "finalEquity": perf.get("final_equity"),
                    "sourceCapital": perf.get("source_capital"),
                },
                "equity": curve,
            }
        except Exception:
            c["data"] = {"stats": {}, "equity": []}
    c["n"] += 1
    return c["data"]


# Secondary index strip (BankNifty / Sensex / FinNifty). Kept warm by the
# background refresher in server.py (`_start_secondary_refresher`) so the
# per-tick snapshot read never blocks on a network call. `_secondary` only
# reads this shared dict; it seeds it once synchronously as a safety net for
# the very first snapshot before the refresher has run.
_SEC_CACHE: dict = {"data": None}


def _secondary(cfg: Config) -> dict:
    # Read-only view of the strip kept warm by the background refresher in
    # server.py, which is the SOLE producer. We deliberately do NOT fetch here:
    # doing so made the snapshot builder a second concurrent producer that also
    # mutated quant_engine._SECONDARY_LAST, racing the refresher. Until the
    # refresher has published, return null placeholders (UI shows '—').
    data = _SEC_CACHE["data"]
    if data:
        return data
    return {k: {"value": None, "chg": None} for k in ("banknifty", "sensex", "finnifty")}


def build_snapshot(cfg: Config, mc: dict | None = None,
                   probe: Probe | None = None) -> dict:
    """The full live snapshot consumed by the terminal."""
    probe = probe or Probe()

    probe.mark("build_decision", primary=cfg.primary, use_live=cfg.use_live,
               use_live_chain=cfg.use_live_chain)
    d = build_decision(cfg)
    vs, reg, pos, sig, sz = (d.vol_state, d.regime, d.positioning,
                             d.signal, d.sizing)
    lot = cfg.primary_instrument.lot_size
    spot = vs.spot

    # Log every engine value that feeds a downstream IV/VRP/Greeks/MC calc.
    probe.mark("engine.outputs", source=d.source, spot=spot, vix=vs.vix,
               iv_rank=vs.iv_rank, iv_pctile=vs.iv_pctile,
               hv20=vs.hv.get(20, float("nan")), vrp=vs.iv_minus_hv,
               em_expiry=vs.em_expiry, p_inside1=vs.p_inside_1sigma,
               regime=reg.regime.value, credit=sig.credit,
               max_risk=sig.max_risk, n_legs=len(sig.legs),
               lots=sz.lots, dte=cfg.dte)

    # --- 3D IV surface (real chain IV if live, else parametric) ----------
    probe.mark("build_surface", spot=spot, vix=vs.vix, iv_rank=vs.iv_rank,
               synthetic=pos.synthetic)
    strikes, dtes, grid = build_surface(vs, cfg)
    surface = {
        "strikes": strikes.round(0).tolist(),
        "expiries": dtes.round(0).tolist(),
        "iv": grid.round(2).tolist(),
        "live": not pos.synthetic,
    }
    # Front-expiry smile + ATM term structure derived from the surface.
    probe.mark("surface.smile_term", grid_shape=list(grid.shape),
               iv_min=float(grid.min()), iv_max=float(grid.max()))
    atm_i = int(np.argmin(np.abs(strikes - spot)))
    smile = {"strikes": strikes.round(0).tolist(),
             "iv": grid[0].round(2).tolist()}
    term = {"dte": dtes.round(0).tolist(),
            "iv": grid[:, atm_i].round(2).tolist()}
    # Real day-over-day IV memory (yesterday / 5-day smile, tenor curves,
    # surface change). Never fabricated — empty until history accumulates.
    try:
        vol_history = record_and_derive(spot, strikes, dtes, grid)
    except Exception:
        vol_history = None

    # --- Greeks (presentation layer) -------------------------------------
    probe.mark("position_greeks", spot=spot, vix=vs.vix, t=cfg.dte / 365.0,
               lot=lot, rate=cfg.risk_free_rate,
               strikes=[l.strike for l in sig.legs])
    g = position_greeks(sig.legs, spot, vs.vix, cfg.dte / 365.0, lot,
                        cfg.risk_free_rate)

    # --- Option chain ----------------------------------------------------
    probe.mark("chain_rows", spot=spot, vix=vs.vix)
    chain, chain_syn = _chain_rows(cfg, spot, vs.vix)

    # --- Risk ------------------------------------------------------------
    equity = cfg.capital
    risk = {
        "equity": equity,
        "capitalAtRisk": sz.capital_at_risk,
        "portfolioHeat": (sz.capital_at_risk / equity) if equity else 0.0,
        "marginUsed": sz.margin_used,
        "marginUsage": (sz.margin_used / equity) if equity else 0.0,
        "lots": sz.lots,
        "kellyLots": sz.kelly_lots,
        "kellyPct": (sz.kelly_lots / max(sz.lots, 1)) if sz.lots else 0.0,
    }
    if mc:
        risk.update({
            "probRuin": mc["pRuin"], "expectedDrawdown": mc["expectedDrawdown"],
            "medianMaxDD": mc["medianMaxDD"], "worstMaxDD": mc["worstMaxDD"],
        })

    # --- Trade decision --------------------------------------------------
    probe.mark("trade_decision", iv_rank=vs.iv_rank, vrp=vs.iv_minus_hv,
               confidence=reg.confidence, p_inside1=vs.p_inside_1sigma,
               credit=sig.credit, lot=lot)
    ivr = vs.iv_rank if vs.iv_rank == vs.iv_rank else 50.0
    premium_rich = max(0.0, min(100.0, 0.6 * ivr + 0.4 * max(0.0, vs.iv_minus_hv) * 10))
    edge = max(0.0, min(100.0, 0.5 * reg.confidence + 0.3 * ivr +
                        20 * vs.p_inside_1sigma))
    credit_rupees = sig.credit * lot
    tp = credit_rupees * cfg.take_profit_frac
    sl = credit_rupees * cfg.stop_loss_mult
    reasons, rejects = [], []
    if d.trade:
        reasons = [reg.policy.edge, sig.note,
                   f"IV-rank {ivr:.0f}, VRP {vs.iv_minus_hv:+.1f}",
                   f"P(in 1σ range) {vs.p_inside_1sigma*100:.0f}%"]
    else:
        if not reg.policy.trade:
            rejects.append(f"Regime {reg.regime.value}: {reg.policy.edge}")
        if not sig.is_tradable:
            rejects.append(sig.note or "No tradable structure")
        if sz.lots == 0:
            rejects.append(sz.reason)
    trade = {
        "decision": "TRADE" if d.trade else "NO_TRADE",
        "confidence": d.confidence,
        "edgeScore": round(edge, 0),
        "premiumRichness": round(premium_rich, 0),
        "structure": sig.strategy.value,
        "expectedReturn": round(credit_rupees * max(sz.lots, 1), 0),
        "maxLoss": sz.capital_at_risk or round(sig.max_risk * lot * max(sz.lots, 1), 0),
        "tailRisk": round((mc["pDD20"] * 100) if mc else 0.0, 1),
        "shortPut": sig.short_put, "shortCall": sig.short_call,
        "takeProfit": round(tp, 0), "stopLoss": round(sl, 0),
        "creditPerLot": round(credit_rupees, 0),
        "reasons": [r for r in reasons if r],
        "rejectReasons": [r for r in rejects if r],
    }

    # --- Strategy ranking (V2 AI Decision Engine) -------------------------
    probe.mark("strategy_ranking", iv_rank=vs.iv_rank, regime=reg.regime.value)
    mc_obj = MarketConditions(
        spot=spot, vix=vs.vix,
        iv_rank=vs.iv_rank if math.isfinite(vs.iv_rank) else 50.0,
        iv_pctile=vs.iv_pctile if math.isfinite(vs.iv_pctile) else 50.0,
        vrp=vs.iv_minus_hv if math.isfinite(vs.iv_minus_hv) else 0.0,
        regime=_ui_regime(reg),
        confidence=reg.confidence,
        dte=cfg.dte,
        p_inside_1sigma=vs.p_inside_1sigma,
        em_expiry=vs.em_expiry,
        lot_size=lot,
    )
    try:
        strategies = rank_strategies(mc_obj)
    except Exception:
        strategies = {"top3": [], "totalScored": 0, "marketCondition": "", "allScores": {}}

    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": d.source,
        "spot": round(spot, 1),
        "regime": {
            "state": _ui_regime(reg),
            "engineRegime": reg.regime.value,
            "confidence": reg.confidence,
            "direction": reg.direction,
            "vix": vs.vix, "vixChg": reg.vix_chg,
            "trendAtr": reg.trend_strength,
            "note": reg.policy.edge,
            "trade": reg.policy.trade,
        },
        "vol": {
            "vix": vs.vix, "ivRank": round(ivr, 1), "ivPctile": vs.iv_pctile,
            "hv20": vs.hv.get(20, float("nan")), "vrp": vs.iv_minus_hv,
            "em1d": vs.em_1d, "emExpiry": vs.em_expiry,
            "sigma1": [vs.sigma1_lo, vs.sigma1_hi],
            "sigma2": [vs.sigma2_lo, vs.sigma2_hi],
            "pInside1": vs.p_inside_1sigma,
        },
        "surface": surface, "smile": smile, "term": term,
        "volHistory": vol_history,
        "greeks": g.as_dict(),
        "chain": chain, "chainSynthetic": chain_syn,
        "positioning": {
            "maxPain": pos.max_pain, "pcr": pos.pcr_oi,
            "support": pos.support, "resistance": pos.resistance,
            "gex": pos.gex, "gammaFlip": pos.gamma_flip,
            "synthetic": pos.synthetic,
        },
        "risk": risk,
        "montecarlo": mc or {},
        "trade": trade,
        "strategies": strategies,
        "history": _history(cfg),
        "backtest": _backtest(cfg),
        "secondary": _secondary(cfg),
    }
