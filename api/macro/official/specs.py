"""Per-indicator official-data specs: schedule + bootstrap seed.

This replaces the old config_official.py "edit on every release" model. Values
now come from scheduled sources (sources.py) and the persistent cache; the seed
below is only the one-time bootstrap / last-resort fallback. Update `next_release`
when official calendars change; real values arrive automatically from sources.
"""
from __future__ import annotations

from .models import OfficialSpec

# Refresh cadences reflect how often each figure can change:
#   Repo/CPI/GDP — daily check (they only move on scheduled releases)
#   FII/DII/breadth — twice daily (captured after market close)
SPECS: list[OfficialSpec] = [
    OfficialSpec("repo", "RBI · Monetary Policy Committee", 24, "2026-08-06", 6.50, "2026-06-05"),
    OfficialSpec("cpi", "MOSPI · CPI (Combined, YoY)", 24, "2026-07-13", 4.85, "2026-06-12"),
    OfficialSpec("gdp", "MOSPI · Real GDP (YoY)", 24, "2026-08-29", 7.20, "2026-05-29"),
    OfficialSpec("fii", "NSE · FII provisional cash (₹Cr)", 12, None, 1246.0, "2026-06-29"),
    OfficialSpec("dii", "NSE · DII provisional cash (₹Cr)", 12, None, 2135.0, "2026-06-29"),
    OfficialSpec("breadth", "NSE · NIFTY 500 advance/decline (EOD)", 12, None, 1.18, "2026-06-29"),
]
