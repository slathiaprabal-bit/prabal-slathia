"""OFFICIAL / dated provider — Repo, CPI, GDP, FII, DII, breadth.

Reads the operator-maintained config (config_official.py). These are never
fetched live: they carry the authoritative value plus its release date and next
scheduled release, with status OFFICIAL, so the UI shows exactly how fresh each
figure is. To wire a real EOD feed later (e.g. NSE provisional flows), replace
this one provider — the contract is identical.
"""
from __future__ import annotations

from ..base import MacroQuote, OFFICIAL, NO_LIVE_DATA
from ..config_official import OFFICIAL_FIGURES


class OfficialProvider:
    name = "Official (RBI / MOSPI / NSE)"

    def fetch(self) -> dict[str, MacroQuote]:
        out: dict[str, MacroQuote] = {}
        for key, rec in OFFICIAL_FIGURES.items():
            val = rec.get("value")
            out[key] = MacroQuote(
                key=key,
                value=float(val) if val is not None else None,
                previous=rec.get("previous"),
                timestamp=rec.get("asof"),
                source=rec.get("source", self.name),
                status=OFFICIAL if val is not None else NO_LIVE_DATA,
                confidence=1.0 if val is not None else 0.0,
                asof=rec.get("asof"),
                next_release=rec.get("next_release"),
            )
        return out
