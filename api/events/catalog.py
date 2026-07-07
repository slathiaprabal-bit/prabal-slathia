"""Official scheduled-event catalog (the StaticScheduleSource bootstrap).

These are OFFICIAL, publicly-published calendar dates (central-bank meeting
calendars, statistical-agency release schedules, government dates) — not
fabricated. This is the swappable bootstrap: a live calendar API (or a paid
provider) replaces StaticScheduleSource without any other change. Operator-
maintained: verify/extend dates against the official calendars and keep
`source_url` pointing at the authority.

Times carry the correct local UTC offset. Market-structure events (expiries,
rebalances) are COMPUTED in sources/expiries.py, not listed here.
"""
from __future__ import annotations

# Each entry mirrors EventRecord fields (minus id / last_updated, set by the
# source). vol_magnitude is 0..1; expected_vol is the coarse hint the frontend
# rules refine into the full Trading Impact Rating.
CATALOG: list[dict] = [
    # ── Global Macro · US (Fed / BLS / BEA) ──
    {"type": "US_NFP", "name": "US Jobs Report (NFP)", "category": "GLOBAL_MACRO", "country": "US",
     "datetime": "2026-07-03T08:30:00-04:00", "importance": "HIGH", "expected_vol": "EXPANSION", "vol_magnitude": 0.7,
     "markets": ["NIFTY", "BANKNIFTY", "USDINR", "DXY", "US10Y"], "sectors": ["IT", "Banks"],
     "description": "US non-farm payrolls — sets the near-term Fed path; drives DXY, US yields and global risk.",
     "source": "US Bureau of Labor Statistics", "source_url": "https://www.bls.gov/schedule/news_release/empsit.htm"},
    {"type": "US_CPI", "name": "US CPI (Jun)", "category": "GLOBAL_MACRO", "country": "US",
     "datetime": "2026-07-15T08:30:00-04:00", "importance": "CRITICAL", "expected_vol": "EXPANSION", "vol_magnitude": 0.85,
     "markets": ["NIFTY", "BANKNIFTY", "USDINR", "DXY", "US10Y"], "sectors": ["IT", "Banks", "Exporters"],
     "description": "US consumer inflation — the single biggest scheduled vol event for rates and EM risk.",
     "source": "US Bureau of Labor Statistics", "source_url": "https://www.bls.gov/schedule/news_release/cpi.htm"},
    {"type": "US_PPI", "name": "US PPI (Jun)", "category": "GLOBAL_MACRO", "country": "US",
     "datetime": "2026-07-16T08:30:00-04:00", "importance": "MEDIUM", "expected_vol": "EXPANSION", "vol_magnitude": 0.45,
     "markets": ["USDINR", "DXY", "US10Y"], "sectors": ["IT"],
     "description": "US producer prices — a secondary inflation read into PCE.",
     "source": "US Bureau of Labor Statistics", "source_url": "https://www.bls.gov/ppi/"},
    {"type": "US_RETAIL", "name": "US Retail Sales (Jun)", "category": "GLOBAL_MACRO", "country": "US",
     "datetime": "2026-07-16T08:30:00-04:00", "importance": "MEDIUM", "expected_vol": "EXPANSION", "vol_magnitude": 0.4,
     "markets": ["DXY", "US10Y"], "sectors": [],
     "description": "US consumer demand gauge — growth signal for the Fed path.",
     "source": "US Census Bureau", "source_url": "https://www.census.gov/retail/"},
    {"type": "US_GDP", "name": "US GDP (Q2 adv)", "category": "GLOBAL_MACRO", "country": "US",
     "datetime": "2026-07-30T08:30:00-04:00", "importance": "HIGH", "expected_vol": "EXPANSION", "vol_magnitude": 0.55,
     "markets": ["DXY", "US10Y", "NIFTY"], "sectors": ["IT"],
     "description": "US advance GDP — growth surprise risk for global risk appetite.",
     "source": "US Bureau of Economic Analysis", "source_url": "https://www.bea.gov/"},
    {"type": "FOMC", "name": "FOMC Decision", "category": "GLOBAL_MACRO", "country": "US",
     "datetime": "2026-07-29T14:00:00-04:00", "importance": "CRITICAL", "expected_vol": "EXPANSION", "vol_magnitude": 0.9,
     "markets": ["NIFTY", "BANKNIFTY", "USDINR", "DXY", "US10Y"], "sectors": ["IT", "Banks", "Realty"],
     "description": "Fed rate decision + presser — top-tier global vol event; pre-event IV bid, post-event crush.",
     "source": "US Federal Reserve", "source_url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"},
    {"type": "FED_SPEECH", "name": "Fed Chair Speech (Jackson Hole)", "category": "GLOBAL_MACRO", "country": "US",
     "datetime": "2026-08-21T10:00:00-04:00", "importance": "HIGH", "expected_vol": "EXPANSION", "vol_magnitude": 0.6,
     "markets": ["DXY", "US10Y", "NIFTY"], "sectors": ["IT"],
     "description": "Fed Chair policy remarks — forward-guidance risk.",
     "source": "US Federal Reserve", "source_url": "https://www.federalreserve.gov/"},
    # ── Global Macro · Other central banks ──
    {"type": "ECB", "name": "ECB Rate Decision", "category": "GLOBAL_MACRO", "country": "EU",
     "datetime": "2026-07-16T14:15:00+02:00", "importance": "HIGH", "expected_vol": "EXPANSION", "vol_magnitude": 0.5,
     "markets": ["DXY", "USDINR"], "sectors": [],
     "description": "ECB policy — EUR/USD and global rates risk.",
     "source": "European Central Bank", "source_url": "https://www.ecb.europa.eu/"},
    {"type": "BOJ", "name": "BOJ Policy Decision", "category": "GLOBAL_MACRO", "country": "JP",
     "datetime": "2026-07-31T11:00:00+09:00", "importance": "HIGH", "expected_vol": "EXPANSION", "vol_magnitude": 0.55,
     "markets": ["DXY", "USDINR"], "sectors": [],
     "description": "Bank of Japan policy — JPY carry / global liquidity risk.",
     "source": "Bank of Japan", "source_url": "https://www.boj.or.jp/en/"},
    {"type": "BOE", "name": "BOE Rate Decision", "category": "GLOBAL_MACRO", "country": "GB",
     "datetime": "2026-08-06T12:00:00+01:00", "importance": "MEDIUM", "expected_vol": "EXPANSION", "vol_magnitude": 0.4,
     "markets": ["DXY"], "sectors": [],
     "description": "Bank of England policy — GBP and rates risk.",
     "source": "Bank of England", "source_url": "https://www.bankofengland.co.uk/"},
    # ── India Macro / Policy ──
    {"type": "IN_CPI", "name": "India CPI (Jun)", "category": "INDIA_MACRO", "country": "IN",
     "datetime": "2026-07-13T17:30:00+05:30", "importance": "HIGH", "expected_vol": "EXPANSION", "vol_magnitude": 0.5,
     "markets": ["NIFTY", "BANKNIFTY", "USDINR"], "sectors": ["Banks", "Autos", "Realty"],
     "description": "India CPI — sets RBI easing room; rate-sensitive sectors react.",
     "source": "MOSPI", "source_url": "https://mospi.gov.in/"},
    {"type": "RBI_MPC", "name": "RBI MPC Decision", "category": "INDIA_MACRO", "country": "IN",
     "datetime": "2026-08-06T10:00:00+05:30", "importance": "CRITICAL", "expected_vol": "EXPANSION", "vol_magnitude": 0.8,
     "markets": ["NIFTY", "BANKNIFTY", "USDINR"], "sectors": ["Banks", "NBFC", "Autos", "Realty"],
     "description": "RBI rate decision + stance — top domestic vol event; banks/NBFCs most exposed.",
     "source": "RBI", "source_url": "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx"},
    {"type": "RBI_MINUTES", "name": "RBI MPC Minutes", "category": "INDIA_MACRO", "country": "IN",
     "datetime": "2026-08-20T17:00:00+05:30", "importance": "MEDIUM", "expected_vol": "NEUTRAL", "vol_magnitude": 0.25,
     "markets": ["NIFTY", "BANKNIFTY"], "sectors": ["Banks"],
     "description": "RBI minutes — tone/forward-guidance colour; usually a lower-vol event.",
     "source": "RBI", "source_url": "https://www.rbi.org.in/"},
    {"type": "UNION_BUDGET", "name": "Union Budget", "category": "INDIA_MACRO", "country": "IN",
     "datetime": "2027-02-01T11:00:00+05:30", "importance": "CRITICAL", "expected_vol": "EXPANSION", "vol_magnitude": 0.95,
     "markets": ["NIFTY", "BANKNIFTY"], "sectors": ["Infra", "Defence", "Railways", "Banks", "Autos"],
     "description": "Union Budget — highest single-session event risk of the Indian calendar.",
     "source": "Government of India", "source_url": "https://www.indiabudget.gov.in/"},
]
