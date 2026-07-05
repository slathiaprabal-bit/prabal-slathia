"""Intraday volatility replay buffer.

Records a compact volatility sample (spot, vol metrics, smile, ATM term, IV
surface) every few minutes while the server runs, scoped to the current IST
session. The terminal's Session Replay scrubber reads these to re-render the
smile, term structure, surface and engine state AT a past moment — real
recorded observations only; the buffer starts empty every session and nothing
is back-filled.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone

_IST = timezone(timedelta(hours=5, minutes=30))
_SAMPLE_EVERY_S = 300      # one sample / 5 min ≈ 75 per session
_MAX_SAMPLES = 120

_lock = threading.Lock()
_session_date: str | None = None
_samples: list[dict] = []
_last_sample = 0.0


def record(sample: dict) -> None:
    """Append a sample (throttled); reset the buffer on a new IST date."""
    global _session_date, _samples, _last_sample
    now = time.time()
    ist = datetime.now(_IST)
    date = ist.strftime("%Y-%m-%d")
    with _lock:
        if date != _session_date:
            _session_date, _samples, _last_sample = date, [], 0.0
        if now - _last_sample < _SAMPLE_EVERY_S:
            return
        _samples.append({**sample, "ts": ist.isoformat(), "t": ist.strftime("%H:%M")})
        if len(_samples) > _MAX_SAMPLES:
            _samples = _samples[-_MAX_SAMPLES:]
        _last_sample = now


def session() -> dict:
    with _lock:
        return {"date": _session_date, "samples": list(_samples)}
