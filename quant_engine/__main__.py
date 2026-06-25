"""Command-line runner.

    python -m quant_engine                 # live reco + backtest summary
    python -m quant_engine --no-live       # force synthetic/cached data
    python -m quant_engine --capital 500000 --risk 0.015
    python -m quant_engine --save out/      # write trade log + equity csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .config import Config
from .engine import Backtest, recommend, run_full
from .signal import Strategy


def _fmt_money(x: float) -> str:
    return f"₹{x:,.0f}"


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Mini-Renaissance quant options engine")
    p.add_argument("--no-live", action="store_true", help="skip live download")
    p.add_argument("--capital", type=float, default=None)
    p.add_argument("--risk", type=float, default=None)
    p.add_argument("--primary", choices=["NIFTY", "BANKNIFTY"], default=None)
    p.add_argument("--save", type=str, default=None, help="dir to write csv outputs")
    p.add_argument("--report", action="store_true",
                   help="print the full Daily Decision Engine report")
    p.add_argument("--simulate", action="store_true",
                   help="Monte-Carlo probability-of-ruin simulation")
    p.add_argument("--paths", type=int, default=5000)
    p.add_argument("--horizon", type=int, default=50, help="trades per sim path")
    args = p.parse_args(argv)

    cfg = Config.from_env()
    if args.no_live:
        cfg.use_live = False
    if args.capital:
        cfg.capital = args.capital
    if args.risk:
        cfg.risk_per_trade = args.risk
    if args.primary:
        cfg.primary = args.primary

    if args.report:
        from .report import build_decision, render
        print(render(build_decision(cfg), cfg))
        return 0

    if args.simulate:
        from .simulate import run_simulation
        try:
            print(run_simulation(cfg, trades_per_path=args.horizon, paths=args.paths).render())
        except ValueError as e:
            print(f"Cannot simulate: {e}")
        return 0

    df, source, bt, sig, sizing = run_full(cfg)

    last = df.iloc[-1]
    print("=" * 64)
    print(f"  MINI-RENAISSANCE QUANT ENGINE  |  {cfg.primary}")
    print("=" * 64)
    print(f"  Data source     : {source.upper()}")
    print(f"  As-of date      : {str(last['Date'])[:10]}")
    print(f"  Spot            : {last['Close']:,.1f}")
    print(f"  India VIX       : {last['VIX']:.2f}")
    print(f"  20D MA          : {last['MA']:,.1f}")
    print("-" * 64)
    print("  LIVE RECOMMENDATION")
    print(f"    Regime / Trend: {sig.regime.value} / {sig.trend.value}")
    print(f"    Strategy      : {sig.strategy.value}")
    if sig.strategy != Strategy.NO_TRADE:
        if sig.short_put:
            print(f"    Short PUT     : {sig.short_put:,.0f}")
        if sig.short_call:
            print(f"    Short CALL    : {sig.short_call:,.0f}")
        print(f"    Net credit    : {sig.credit:,.1f} pts/lot  "
              f"({_fmt_money(sig.credit * cfg.primary_instrument.lot_size)}/lot)")
        print(f"    Max risk      : {sig.max_risk:,.1f} pts/lot")
        print(f"    Lots          : {sizing.lots}  "
              f"(capital@risk {_fmt_money(sizing.capital_at_risk)}; {sizing.reason})")
    print(f"    Note          : {sig.note}")
    print("-" * 64)

    perf = bt.performance()
    print("  BACKTEST PERFORMANCE")
    if perf.get("trades", 0) == 0:
        print("    No trades generated on this dataset.")
    else:
        print(f"    Trades        : {perf['trades']}")
        print(f"    Win rate      : {perf['win_rate_pct']}%")
        print(f"    Profit factor : {perf['profit_factor']}")
        print(f"    Total return  : {perf['total_return_pct']}%  "
              f"({_fmt_money(perf['total_pnl'])})")
        print(f"    Final equity  : {_fmt_money(perf['final_equity'])}")
        print(f"    Max drawdown  : {perf['max_drawdown_pct']}%")
        print(f"    Sharpe        : {perf['sharpe']}")
    print("=" * 64)

    if args.save:
        out = Path(args.save)
        out.mkdir(parents=True, exist_ok=True)
        bt.trade_log().to_csv(out / "trade_log.csv", index=False)
        bt.equity_df().to_csv(out / "equity_curve.csv", index=False)
        print(f"  Saved trade_log.csv & equity_curve.csv -> {out}/")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
