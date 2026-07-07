"""Market Structure Provider — the single source of truth for index-options
expiry structure across VOLARA.

Per-instrument expiry weekdays (NIFTY weekly Tue, SENSEX weekly Thu, BankNifty/
FinNifty/MidcpNifty monthly Tue, BankEx monthly Thu, ...) live in config.py.
Holidays move an expiry to the previous trading day automatically. Every module
(Market Events, Timeline, Trading Impact, Strategy Lab, Research Agent, future
modules) MUST read expiries from this provider / GET /api/market-structure —
never recompute them. A future exchange change is a one-line edit to config.py.
"""
