# Mini-Renaissance — Indian Index Options Quant Engine

A compact, **fully-runnable** premium-selling model for the Indian
index-derivatives market (**NIFTY / BANKNIFTY**). It detects the volatility
regime from **India VIX**, builds a defined-risk option structure, sizes the
position against a risk budget, backtests it, and serves a **live dashboard**.

This was built out from the `mini_renaissance_package` skeleton — the
placeholder modules (`config.py`, `signal.py`, `engine.py`, `dashboard.py`) are
now a working system, and the column schema from `quant_option_system.xlsx`
(TRADE_LOG / MARKET_DATA / RISK_ENGINE / PERFORMANCE) is implemented in code.

---

## Pipeline

```
data.py     →   signal.py        →   risk.py          →   engine.py        →   dashboard.py
live/synth      regime+strategy      position sizing       backtest/live        Streamlit UI
```

| Module        | Responsibility |
|---------------|----------------|
| `config.py`   | All tunables: capital, risk %, VIX bands, lot sizes, strategy params |
| `data.py`     | Live download (yfinance) → cache → synthetic fallback + features (MA/ATR/VIX) |
| `pricing.py`  | Black-Scholes pricing & VIX-implied move |
| `signal.py`   | Regime detection + option-structure construction |
| `risk.py`     | Risk-based sizing, drawdown throttle, daily loss limit |
| `engine.py`   | Daily backtest + live recommendation + performance report |
| `dashboard.py`| Streamlit live dashboard |

---

## "Live" data

The data layer is **live-capable**. With network access it pulls real NIFTY
(`^NSEI`) / BANKNIFTY (`^NSEBANK`) and India VIX (`^INDIAVIX`) history from
Yahoo Finance via `yfinance`. If the network is blocked or offline it
transparently falls back to a cached CSV, and finally to a realistic
**synthetic** market generator (stochastic-vol GBM with VIX clustering) so the
entire system always runs. The active source is reported as
`LIVE / CACHED / SYNTHETIC`.

> In a locked-down sandbox (e.g. CI with egress filtering) you'll see
> `SYNTHETIC`. Run it on your own machine for `LIVE`.

---

## Strategy logic

| Regime (India VIX)      | Market read        | Structure |
|-------------------------|--------------------|-----------|
| **CALM** (`<13`)        | range-bound        | Iron Condor (sell both wings) |
| **NORMAL** (`13–18`)    | trending up        | Bull Put Spread (sell puts) |
| **NORMAL**              | trending down      | Bear Call Spread (sell calls) |
| **ELEVATED** (`18–25`)  | any / event gap    | single-side spread, throttled |
| **HIGH** (`>25`)        | risk-off           | **No trade** |

Short strikes are placed ~1σ from spot using the VIX-implied move; protective
wings make every position **defined-risk**. Exits: take-profit at 50% of credit,
stop-loss at 2× credit, or expiry.

Risk sizing: lots are chosen so worst-case loss ≤ `risk_per_trade` (default 2%)
of equity, then scaled down by a drawdown throttle (75% → 50% → 25% → flat).

---

## Quick start

```bash
pip install -r quant_engine/requirements.txt

# Terminal: live recommendation + backtest summary
python -m quant_engine

# Force offline / reproducible run
python -m quant_engine --no-live

# Tweak capital / risk / index, and save outputs
python -m quant_engine --capital 500000 --risk 0.015 --primary BANKNIFTY --save out/

# Live dashboard
streamlit run quant_engine/dashboard.py
```

Environment overrides: `QE_CAPITAL`, `QE_RISK`, `QE_PRIMARY`, `QE_USE_LIVE`.

---

## Sample output

```
  Regime / Trend: NORMAL / UP
  Strategy      : BULL_PUT_SPREAD
  Short PUT     : 27,100
  Net credit    : 21.8 pts/lot
  ...
  BACKTEST PERFORMANCE
  Trades: 106 | Win rate: 83.0% | Profit factor: 1.43
  Total return: 4.64% | Max DD: 2.65% | Sharpe: 1.36
```

---

## ⚠️ Disclaimer

Educational / research tool. **Not investment advice.** Short-option strategies
carry large tail risk. Backtest results use modelled (Black-Scholes) option
marks, not traded prices, and ignore assignment/liquidity. Validate
independently and paper-trade before risking capital.
