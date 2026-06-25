"""Data layer: live download with a realistic synthetic fallback.

Public entry point: ``get_market_data(config)`` returns a pandas DataFrame
with columns: Date, Open, High, Low, Close, ATR, VIX, Return, MA, Gap.

When ``config.use_live`` is True the loader first tries Yahoo Finance via
yfinance. If that fails (no network / blocked egress / offline), it loads any
cached CSV; failing that it generates a reproducible synthetic market so the
rest of the pipeline always runs.
"""

from __future__ import annotations

import math
import warnings
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd

from .config import Config


# --------------------------------------------------------------------------- #
# Live download
# --------------------------------------------------------------------------- #
def _fetch_live(config: Config) -> pd.DataFrame | None:
    """Try to pull live index + VIX history from Yahoo Finance."""
    try:
        import yfinance as yf
    except Exception:
        return None

    sym = config.primary_instrument.yahoo_symbol
    try:
        period = f"{max(config.history_days + 60, 120)}d"
        px = yf.download(sym, period=period, interval="1d",
                         progress=False, auto_adjust=False)
        vix = yf.download(config.vix_symbol, period=period, interval="1d",
                          progress=False, auto_adjust=False)
    except Exception as exc:  # network / proxy / parse failure
        warnings.warn(f"[data] live download failed for {sym}: {exc}")
        return None

    if px is None or px.empty:
        return None

    # yfinance may return a MultiIndex column frame for a single ticker.
    px = _flatten(px)
    df = pd.DataFrame({
        "Date": pd.to_datetime(px.index).tz_localize(None),
        "Open": px["Open"].to_numpy(dtype=float).ravel(),
        "High": px["High"].to_numpy(dtype=float).ravel(),
        "Low": px["Low"].to_numpy(dtype=float).ravel(),
        "Close": px["Close"].to_numpy(dtype=float).ravel(),
    }).reset_index(drop=True)

    if vix is not None and not vix.empty:
        vix = _flatten(vix)
        vser = pd.Series(vix["Close"].to_numpy(dtype=float).ravel(),
                         index=pd.to_datetime(vix.index).tz_localize(None))
        df["VIX"] = df["Date"].map(vser).to_numpy()
        df["VIX"] = df["VIX"].ffill().bfill()
    else:
        df["VIX"] = _vix_from_realised(df["Close"])

    df = df.dropna(subset=["Close"]).reset_index(drop=True)
    return df if len(df) > config.trend_ma + config.atr_window else None


def _flatten(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = df.columns.get_level_values(0)
    return df


# --------------------------------------------------------------------------- #
# Synthetic fallback
# --------------------------------------------------------------------------- #
def _vix_from_realised(close: pd.Series, window: int = 20) -> pd.Series:
    rets = np.log(close / close.shift(1))
    rv = rets.rolling(window).std() * math.sqrt(252) * 100.0
    return rv.ffill().bfill().clip(8, 40)


def generate_synthetic(config: Config) -> pd.DataFrame:
    """Reproducible NIFTY-like series with volatility clustering (GARCH-ish).

    Produces trending and mean-reverting regimes plus a VIX series that is
    inversely correlated with returns, mimicking the real index/VIX dynamic.
    """
    rng = np.random.default_rng(config.seed)
    n = config.history_days
    s0 = 22000.0
    mu = 0.10 / 252.0            # ~10% annual drift
    # Stochastic volatility: AR(1) in log-vol => clustering.
    log_vol = np.empty(n)
    log_vol[0] = math.log(0.12 / math.sqrt(252))
    kappa, theta, xi = 0.05, math.log(0.13 / math.sqrt(252)), 0.15
    for t in range(1, n):
        log_vol[t] = log_vol[t - 1] + kappa * (theta - log_vol[t - 1]) + xi * rng.standard_normal()
    daily_vol = np.exp(log_vol)

    shocks = rng.standard_normal(n)
    rets = mu + daily_vol * shocks
    close = s0 * np.exp(np.cumsum(rets))

    # Intraday OHLC around the close.
    intraday = daily_vol * close
    openp = np.empty(n); high = np.empty(n); low = np.empty(n)
    prev = s0
    for t in range(n):
        gap = rng.normal(0, 0.3) * intraday[t]
        openp[t] = prev + gap
        hi = max(openp[t], close[t]) + abs(rng.normal(0, 0.6)) * intraday[t]
        lo = min(openp[t], close[t]) - abs(rng.normal(0, 0.6)) * intraday[t]
        high[t] = hi; low[t] = lo; prev = close[t]

    # India-VIX proxy: annualised vol in %, pushed up after down days.
    vix = daily_vol * math.sqrt(252) * 100.0
    vix = vix - 30.0 * np.clip(rets, None, 0)      # fear spikes on drops
    vix = np.clip(vix, 9.0, 45.0)

    dates = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n)
    return pd.DataFrame({
        "Date": dates,
        "Open": openp, "High": high, "Low": low, "Close": close,
        "VIX": vix,
    })


# --------------------------------------------------------------------------- #
# Feature engineering
# --------------------------------------------------------------------------- #
def _true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["Close"].shift(1)
    tr = pd.concat([
        df["High"] - df["Low"],
        (df["High"] - prev_close).abs(),
        (df["Low"] - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr


def add_features(df: pd.DataFrame, config: Config) -> pd.DataFrame:
    df = df.sort_values("Date").reset_index(drop=True).copy()
    df["Return"] = df["Close"].pct_change()
    df["MA"] = df["Close"].rolling(config.trend_ma).mean()
    df["ATR"] = _true_range(df).rolling(config.atr_window).mean()
    df["Gap"] = (df["Open"] - df["Close"].shift(1)) / df["Close"].shift(1)
    df["%Move"] = df["Return"] * 100.0
    return df


# --------------------------------------------------------------------------- #
# Cache helpers
# --------------------------------------------------------------------------- #
def _save_cache(df: pd.DataFrame, config: Config) -> None:
    d: Path = config.data_dir
    d.mkdir(parents=True, exist_ok=True)
    df[["Date", "Open", "High", "Low", "Close", "ATR"]].to_csv(d / "nifty.csv", index=False)
    df[["Date", "VIX"]].to_csv(d / "vix.csv", index=False)


def _load_cache(config: Config) -> pd.DataFrame | None:
    f = config.data_dir / "nifty.csv"
    vf = config.data_dir / "vix.csv"
    if not f.exists():
        return None
    try:
        df = pd.read_csv(f, parse_dates=["Date"])
        if df.empty or "Close" not in df:
            return None
        if vf.exists():
            v = pd.read_csv(vf, parse_dates=["Date"])
            df = df.merge(v, on="Date", how="left")
        if "VIX" not in df:
            df["VIX"] = _vix_from_realised(df["Close"])
        return df
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def get_market_data(config: Config) -> Tuple[pd.DataFrame, str]:
    """Return (features_df, source) where source in {live, cache, synthetic}."""
    raw, source = None, "synthetic"

    if config.use_live:
        raw = _fetch_live(config)
        if raw is not None:
            source = "live"

    if raw is None:
        raw = _load_cache(config)
        if raw is not None and len(raw) > config.trend_ma + config.atr_window:
            source = "cache"
        else:
            raw = None

    if raw is None:
        raw = generate_synthetic(config)
        source = "synthetic"

    df = add_features(raw, config)
    # Refresh the cache with whatever we have (keeps CSVs populated).
    try:
        _save_cache(df, config)
    except Exception:
        pass
    return df, source
