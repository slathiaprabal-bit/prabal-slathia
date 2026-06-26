"""Live Streamlit dashboard.

Run with:
    streamlit run quant_engine/dashboard.py

Shows the current market regime, the recommended option structure, the equity
curve from the rolling backtest, performance stats and the full trade log.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `streamlit run quant_engine/dashboard.py` from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    import streamlit as st
except ModuleNotFoundError:
    print("Streamlit is not installed. Install with:  pip install streamlit")
    print("Then run:  streamlit run quant_engine/dashboard.py")
    raise SystemExit(1)

import pandas as pd

from quant_engine.config import Config
from quant_engine.data import get_market_data
from quant_engine.engine import Backtest, recommend
from quant_engine.signal import Strategy

st.set_page_config(page_title="Mini-Renaissance | Indian Options Quant",
                   layout="wide", page_icon="📈")

REGIME_COLOR = {
    "CALM": "#16a34a", "NORMAL": "#0ea5e9",
    "ELEVATED": "#f59e0b", "HIGH": "#dc2626",
}


@st.cache_data(ttl=300)
def load(use_live: bool, capital: float, risk: float, primary: str):
    cfg = Config.from_env()
    cfg.use_live = use_live
    cfg.capital = capital
    cfg.risk_per_trade = risk
    cfg.primary = primary
    df, source = get_market_data(cfg)
    bt = Backtest(cfg).run(df)
    sig, sizing = recommend(cfg, df)
    return cfg, df, source, bt.trade_log(), bt.equity_df(), bt.performance(), sig, sizing


# ---- Sidebar controls --------------------------------------------------- #
st.sidebar.title("⚙️ Controls")
primary = st.sidebar.selectbox("Index", ["NIFTY", "BANKNIFTY"], index=0)
use_live = st.sidebar.toggle("Use live data (Yahoo Finance)", value=True,
                             help="Falls back to synthetic data if offline/blocked.")
capital = st.sidebar.number_input("Capital (₹)", 100_000, 100_000_000,
                                  1_000_000, step=50_000)
risk = st.sidebar.slider("Risk per trade", 0.005, 0.05, 0.02, 0.005)
if st.sidebar.button("🔄 Refresh"):
    st.cache_data.clear()

cfg, df, source, tl, eq, perf, sig, sizing = load(use_live, capital, risk, primary)
last = df.iloc[-1]

# ---- Header ------------------------------------------------------------- #
st.title("📈 Mini-Renaissance — Indian Index Options Quant")
badge = {"live": "🟢 LIVE", "cache": "🟡 CACHED", "synthetic": "🔵 SYNTHETIC"}[source]
st.caption(f"Data source: **{badge}**  ·  As of **{str(last['Date'])[:10]}**  ·  Index: **{cfg.primary}**")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Spot", f"{last['Close']:,.1f}", f"{last['%Move']:+.2f}%")
c2.metric("India VIX", f"{last['VIX']:.2f}")
c3.metric("20D MA", f"{last['MA']:,.1f}")
c4.metric("ATR(14)", f"{last['ATR']:,.0f}")

# ---- Regime & recommendation ------------------------------------------- #
left, right = st.columns([1, 1])
with left:
    st.subheader("🧭 Market Regime")
    color = REGIME_COLOR.get(sig.regime.value, "#666")
    st.markdown(
        f"<div style='padding:14px;border-radius:10px;background:{color};"
        f"color:white;font-size:22px;font-weight:700;text-align:center'>"
        f"{sig.regime.value} &nbsp;·&nbsp; {sig.trend.value}</div>",
        unsafe_allow_html=True,
    )
    st.write("")
    st.write(f"**Expected 1σ move ({cfg.dte}d):** ±{sig.expected_move:,.0f} pts")
    st.info(sig.note)

with right:
    st.subheader("🎯 Recommended Trade")
    if sig.strategy == Strategy.NO_TRADE or sizing.lots == 0:
        st.warning(f"**NO TRADE** — {sizing.reason if sizing.lots == 0 else sig.note}")
    else:
        lot = cfg.primary_instrument.lot_size
        rows = [{"Action": "SELL" if l.qty < 0 else "BUY",
                 "Type": "CALL" if l.kind == "C" else "PUT",
                 "Strike": f"{l.strike:,.0f}",
                 "Price": f"{l.price:,.1f}"} for l in sig.legs]
        st.markdown(f"### {sig.strategy.value.replace('_', ' ').title()}")
        st.table(pd.DataFrame(rows))
        m1, m2, m3 = st.columns(3)
        m1.metric("Lots", sizing.lots)
        m2.metric("Net credit/lot", f"₹{sig.credit * lot:,.0f}")
        m3.metric("Capital @ risk", f"₹{sizing.capital_at_risk:,.0f}")

st.divider()

# ---- Equity curve & performance ---------------------------------------- #
st.subheader("📊 Backtest")
if tl.empty:
    st.warning("No trades generated for this dataset.")
else:
    ec = eq.set_index("Date")[["Equity"]]
    st.line_chart(ec, height=280)

    cols = st.columns(6)
    cols[0].metric("Total return", f"{perf['total_return_pct']}%")
    cols[1].metric("Trades", perf["trades"])
    cols[2].metric("Win rate", f"{perf['win_rate_pct']}%")
    cols[3].metric("Profit factor", perf["profit_factor"])
    cols[4].metric("Max DD", f"{perf['max_drawdown_pct']}%")
    cols[5].metric("Sharpe", perf["sharpe"])

    with st.expander("📒 Trade log"):
        st.dataframe(tl, use_container_width=True, height=360)

st.caption("⚠️ Educational research tool. Not investment advice. "
           "Options selling carries unlimited/large tail risk — validate before any live use.")
