"""SINGLE SOURCE OF TRUTH for NSE/BSE index-options market structure.

A future exchange change is a one-line edit HERE — nothing else in VOLARA
recomputes expiries. Weekday ints: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4.
"""
from __future__ import annotations

MON, TUE, WED, THU, FRI = 0, 1, 2, 3, 4

# Per-instrument market structure (single source of truth).
#   weekly  : weekday of the weekly expiry, or None if the instrument has none.
#   monthly : weekday whose LAST occurrence in the month is the monthly expiry.
#   exchange: NSE | BSE.
#   lot_size / strike_step: contract lot and listed strike spacing.
# lot_size and strike_step are SEBI/exchange-revised periodically — keep current.
#   label   : display name.  yahoo: quote symbol for spot/HV history.
#   iv_band : typical ATM IV range (vol pts) — parametric anchor of last resort.
# Registering a NEW index here is ALL that is required: the market-structure
# API, the multi-asset vol context provider and the terminal UI all read this.
INSTRUMENTS: dict[str, dict] = {
    "NIFTY":      {"label": "NIFTY 50", "exchange": "NSE", "weekly": TUE, "monthly": TUE, "lot_size": 75, "strike_step": 50, "yahoo": "^NSEI", "iv_band": (10, 22)},
    "SENSEX":     {"label": "SENSEX", "exchange": "BSE", "weekly": THU, "monthly": THU, "lot_size": 20, "strike_step": 100, "yahoo": "^BSESN", "iv_band": (10, 22)},
    "BANKNIFTY":  {"label": "BANK NIFTY", "exchange": "NSE", "weekly": None, "monthly": TUE, "lot_size": 35, "strike_step": 100, "yahoo": "^NSEBANK", "iv_band": (12, 26)},
    "FINNIFTY":   {"label": "FIN NIFTY", "exchange": "NSE", "weekly": None, "monthly": TUE, "lot_size": 65, "strike_step": 50, "yahoo": "NIFTY_FIN_SERVICE.NS", "iv_band": (11, 24)},
    "MIDCPNIFTY": {"label": "MIDCAP NIFTY", "exchange": "NSE", "weekly": None, "monthly": TUE, "lot_size": 120, "strike_step": 25, "yahoo": "NIFTY_MID_SELECT.NS", "iv_band": (13, 28)},
    "BANKEX":     {"label": "BANKEX", "exchange": "BSE", "weekly": None, "monthly": THU, "lot_size": 15, "strike_step": 100, "yahoo": "BSE-BANK.BO", "iv_band": (12, 26)},
}

# IST close — index options settle at 15:30.
EXPIRY_TIME = "15:30:00+05:30"

# Exchange trading holidays (NSE/BSE share most). Operator-maintained: an expiry
# landing on a holiday moves to the PREVIOUS trading day; weekends are handled
# automatically. Seeded with the fixed national market holidays — ADD the full
# official annual list (Holi, Eid, Diwali/Lakshmi Pujan, etc.) for exact
# adjustments. Format: "YYYY-MM-DD".
HOLIDAYS: set[str] = {
    "2026-01-26",  # Republic Day
    "2026-05-01",  # Maharashtra Day
    "2026-08-15",  # Independence Day
    "2026-10-02",  # Gandhi Jayanti
    "2026-12-25",  # Christmas
    # TODO(operator): add the remaining official NSE/BSE holidays for the year.
}
