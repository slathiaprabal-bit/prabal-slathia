"""
Mini-Renaissance Quant Engine
=============================

A compact, fully-runnable options-trading research/execution model for the
Indian index-derivatives market (NIFTY / BANKNIFTY).

Pipeline:
    data  ->  signal (regime + strategy)  ->  risk (position sizing)
          ->  engine (backtest / live recommendation)  ->  dashboard

The data layer is *live-capable*: it pulls real NIFTY and India-VIX history
from Yahoo Finance via ``yfinance`` when the network allows, and transparently
falls back to a realistic synthetic market generator otherwise, so every part
of the system runs out-of-the-box.
"""

from .config import Config, DEFAULT_CONFIG
from .signal import Regime, Strategy, Signal, detect_regime, generate_signal

__all__ = [
    "Config",
    "DEFAULT_CONFIG",
    "Regime",
    "Strategy",
    "Signal",
    "detect_regime",
    "generate_signal",
]

__version__ = "1.0.0"
