"""Data layer: live download with a realistic synthetic fallback.

Public entry point: ``get_market_data(config)`` returns a pandas DataFrame
with columns: Date, Open, High, Low, Close, ATR, VIX, Return, MA, Gap.

When ``config.use_live`` is True the loader first tries Yahoo Finance via
yfinance. If that fails (no network / blocked egress / offline), it loads any
cached CSV; failing that it generates a reproducible synthetic market so the
rest of the pipeline always runs.
"""

from __future__ import annotations

import json
import math
import threading
import warnings
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd

# yfinance is NOT thread-safe: it shares a session / tz-cache / parsing state
# across calls. The FastAPI server downloads from two threads concurrently (the
# per-tick build_snapshot thread for NIFTY/VIX, and the secondary-index
# refresher thread for BankNifty/Sensex/FinNifty). Without serialisation those
# concurrent yf.download() calls race and return each other's frames, which
# showed up as a rotation (banknifty<-vix, sensex<-banknifty, finnifty<-sensex).
# This lock serialises every yfinance download so a call always returns its own
# symbol's data.
_YF_LOCK = threading.Lock()

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
        with _YF_LOCK:
            px = yf.download(sym, period=period, interval="1d",
                             progress=False, auto_adjust=False)
            vix = yf.download(config.vix_symbol, period=period, interval="1d",
                              progress=False, auto_adjust=False)
    except Exception as exc:  # network / proxy / parse failure
        warnings.warn(f"[data] live download failed for {sym}: {exc}")
        return None

    if px is None or px.empty:
        return None

    # yfinance may return a MultiIndex column frame for a single ticker; flatten
    # AND de-duplicate so each OHLC field selects a single 1-D Series (a live
    # 'Close'/'Adj Close' collision otherwise yields a 2-D block whose ravel()
    # doubles its length -> "All arrays must be of the same length").
    px = _flatten(px)
    needed = ["Open", "High", "Low", "Close"]
    missing = [c for c in needed if c not in px.columns]
    if missing:
        warnings.warn(f"[data] live frame for {sym} missing OHLC columns {missing}")
        return None

    # Build from the same frame so every column shares px's row index and is
    # therefore guaranteed equal-length and row-aligned — no parallel ravel().
    df = px[needed].apply(pd.to_numeric, errors="coerce")
    df.insert(0, "Date", pd.to_datetime(px.index).tz_localize(None))
    df = df.reset_index(drop=True)

    if vix is not None and not vix.empty:
        vix = _flatten(vix)
        if "Close" in vix.columns:
            vser = pd.Series(
                pd.to_numeric(vix["Close"], errors="coerce").to_numpy(),
                index=pd.to_datetime(vix.index).tz_localize(None),
            )
            df["VIX"] = df["Date"].map(vser).to_numpy()
            df["VIX"] = df["VIX"].ffill().bfill()
        else:
            df["VIX"] = _vix_from_realised(df["Close"])
    else:
        df["VIX"] = _vix_from_realised(df["Close"])

    df = df.dropna(subset=["Close"]).reset_index(drop=True)
    return df if len(df) > config.trend_ma + config.atr_window else None


def _flatten(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = df.columns.get_level_values(0)
    # Collapse any duplicate field columns (e.g. a 'Close'/'Adj Close' collision
    # after flattening) so selecting a field returns a single 1-D Series.
    if df.columns.duplicated().any():
        df = df.loc[:, ~df.columns.duplicated()]
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
# Secondary index strip (BankNifty / Sensex / FinNifty)
# --------------------------------------------------------------------------- #
# Yahoo Finance symbols for the companion indices shown alongside NIFTY.
_SECONDARY_SYMBOLS: dict[str, str] = {
    "banknifty": "^NSEBANK",
    "sensex": "^BSESN",
    "finnifty": "NIFTY_FIN_SERVICE.NS",
}


def _fetch_secondary_live() -> dict | None:
    """Pull last close + day change for each secondary index via yfinance.

    Uses the same download path as the NIFTY loader. Returns None only if
    yfinance is unavailable; otherwise returns whatever symbols resolved.
    """
    try:
        import yfinance as yf
    except Exception:
        return None

    out: dict[str, dict] = {}
    for key, sym in _SECONDARY_SYMBOLS.items():
        try:
            with _YF_LOCK:
                px = yf.download(sym, period="5d", interval="1d",
                                 progress=False, auto_adjust=False)
            if px is None or px.empty:
                continue
            px = _flatten(px)
            if "Close" not in px:
                continue
            closes = px["Close"].to_numpy(dtype=float).ravel()
            closes = closes[~np.isnan(closes)]
            if len(closes) == 0:
                continue
            last = float(closes[-1])
            prev = float(closes[-2]) if len(closes) > 1 else last
            chg = ((last / prev - 1.0) * 100.0) if prev else 0.0
            out[key] = {"value": round(last, 2), "chg": round(chg, 2)}
        except Exception:
            continue
    return out


# Last-good quotes per symbol, kept across calls so a transient single-symbol
# fetch failure never blanks an index that was previously live.
_SECONDARY_LAST: dict = {}


def get_secondary_indices(config: Config) -> dict:
    """Live quotes for the secondary index strip.

    Mirrors ``get_market_data``'s live -> cache fallback, and merges each
    freshly-fetched symbol over the last-good values: if one of the three
    downloads fails on a given cycle, that index keeps its previous quote
    instead of flickering to None. Returns
    ``{key: {"value": float|None, "chg": float|None}}`` for every key in
    ``_SECONDARY_SYMBOLS``.
    """
    data: dict | None = None
    if config.use_live:
        data = _fetch_secondary_live()

    cache = config.data_dir / "secondary.json"
    if data:
        # Merge only the symbols that resolved this cycle over the last-good set.
        _SECONDARY_LAST.update(data)
        try:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(_SECONDARY_LAST))
        except Exception:
            pass
    elif not _SECONDARY_LAST:
        # Nothing fetched live yet this process — seed from the on-disk cache.
        try:
            if cache.exists():
                _SECONDARY_LAST.update(json.loads(cache.read_text()))
        except Exception:
            pass

    # Build one complete, self-contained snapshot (copied inner dicts so the
    # published object never aliases _SECONDARY_LAST). The caller swaps this in
    # with a single assignment, so a reader never sees a half-updated strip.
    return {k: dict(_SECONDARY_LAST.get(k, {"value": None, "chg": None}))
            for k in _SECONDARY_SYMBOLS}


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
