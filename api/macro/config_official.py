"""Operator-maintained OFFICIAL macro figures (dated).

These are slow-moving authoritative prints and dated flow numbers. They are NOT
fetched live — accuracy and transparency over fake real-time. UPDATE each value
on its release date and bump `asof` / `next_release`. The dashboard surfaces
`asof` + `next_release` so freshness is always explicit.

Sources: RBI (policy repo rate), MOSPI (CPI, GDP), NSE provisional cash data
(FII/DII, market breadth). Replace this file's values on each official release.
"""
from __future__ import annotations

# key -> dated official record. value units match the indicator definitions.
OFFICIAL_FIGURES: dict[str, dict] = {
    # ── Policy / growth / inflation (authoritative, slow) ──
    "repo": {
        "value": 6.50, "asof": "2026-06-05", "next_release": "2026-08-06",
        "source": "RBI · Monetary Policy Committee",
    },
    "cpi": {
        "value": 4.85, "asof": "2026-06-12", "next_release": "2026-07-13",
        "source": "MOSPI · CPI (Combined, YoY)",
    },
    "gdp": {
        "value": 7.20, "asof": "2026-05-29", "next_release": "2026-08-29",
        "source": "MOSPI · Real GDP (YoY)",
    },
    # ── Flows / breadth (dated EOD provisional — never intraday) ──
    "fii": {
        "value": 1246.0, "asof": "2026-06-29", "next_release": None,
        "source": "NSE · FII provisional cash (₹Cr)",
    },
    "dii": {
        "value": 2135.0, "asof": "2026-06-29", "next_release": None,
        "source": "NSE · DII provisional cash (₹Cr)",
    },
    "breadth": {
        "value": 1.18, "asof": "2026-06-29", "next_release": None,
        "source": "NSE · NIFTY 500 advance/decline (EOD)",
    },
}
