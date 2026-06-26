"""Diagnostic instrumentation for the live snapshot pipeline.

Goal: when /api/snapshot (or the WS stream) throws on the *live* feed, capture
the COMPLETE traceback (file + line) AND the inputs/intermediates that were in
flight at the moment of failure — instead of a masked one-line error.

Two mechanisms:
  * Probe  — records the current stage + its input values as the pipeline runs.
             On an exception the server reports the last stage and its inputs,
             so you see exactly which calculation blew up and with what numbers.
  * QT_DEBUG=1 env — additionally streams every stage's values to stderr live,
             so you can watch IV / VRP / Greeks / Sharpe / Monte-Carlo / BS
             inputs tick by tick until the throw.

Nothing here changes any trading calculation; it only observes.
"""

from __future__ import annotations

import os
import sys
import math
import traceback
from typing import Any

DEBUG = os.getenv("QT_DEBUG", "").strip().lower() in ("1", "true", "yes", "on")


def _fmt(v: Any) -> str:
    try:
        if isinstance(v, float):
            return "nan" if math.isnan(v) else f"{v:.6g}"
        if isinstance(v, (list, tuple)):
            if len(v) > 6:
                return f"[{len(v)} items: {', '.join(_fmt(x) for x in v[:4])} …]"
            return "[" + ", ".join(_fmt(x) for x in v) + "]"
        return str(v)
    except Exception:
        return repr(v)


class Probe:
    """Tracks the current pipeline stage and the values feeding it."""

    def __init__(self) -> None:
        self.stage: str = "init"
        self.data: dict[str, Any] = {}
        self.history: list[str] = []

    def mark(self, stage: str, **values: Any) -> None:
        self.stage = stage
        self.data = values
        self.history.append(stage)
        if DEBUG:
            rendered = "  ".join(f"{k}={_fmt(v)}" for k, v in values.items())
            sys.stderr.write(f"[QT-TRACE] {stage:<22} {rendered}\n")
            sys.stderr.flush()

    def snapshot_context(self) -> dict[str, Any]:
        return {
            "failing_stage": self.stage,
            "stage_inputs": {k: _fmt(v) for k, v in self.data.items()},
            "stages_completed": self.history,
        }


def capture_exception(where: str, probe: Probe | None = None) -> dict[str, Any]:
    """Build a rich error payload with the full traceback + failure context."""
    tb = traceback.format_exc()
    # Always surface the full traceback to the server console.
    sys.stderr.write(f"\n[QT-ERROR] exception in {where}:\n{tb}\n")
    sys.stderr.flush()
    exc = sys.exc_info()[1]
    # Pull the deepest frame (the real file:line that raised).
    frames = traceback.extract_tb(sys.exc_info()[2])
    origin = None
    if frames:
        last = frames[-1]
        origin = f"{last.filename}:{last.lineno} in {last.name}() -> {last.line}"
    payload: dict[str, Any] = {
        "error": str(exc),
        "type": type(exc).__name__ if exc else "Unknown",
        "origin": origin,
        "traceback": tb,
        "where": where,
    }
    if probe is not None:
        payload.update(probe.snapshot_context())
    return payload
