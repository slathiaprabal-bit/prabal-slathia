"""Additive interface for the Market Structure Provider: GET /api/market-structure.

The clean, single interface every current and future module reads expiries from
(Market Events consumes it via ExpirySource; Strategy Lab / Research will consume
this endpoint directly). Wired from api/server.py.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from .config import INSTRUMENTS
from .provider import MarketStructureProvider

_provider = MarketStructureProvider()
market_structure_router = APIRouter()


@market_structure_router.get("/api/market-structure")
def get_market_structure():
    exps = _provider.all_expiries()
    next_by_instrument = {
        inst: (e.to_dict() if (e := _provider.next_expiry(inst)) else None)
        for inst in INSTRUMENTS
    }
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "instruments": {
            inst: {
                "exchange": cfg["exchange"], "weekly": cfg["weekly"], "monthly": cfg["monthly"],
                "lotSize": cfg["lot_size"], "strikeStep": cfg["strike_step"],
            }
            for inst, cfg in INSTRUMENTS.items()
        },
        "nextByInstrument": next_by_instrument,
        "expiries": [e.to_dict() for e in exps],
    }
