"""Presentation-layer option Greeks.

This is NOT part of the trading engine — it is a derived view used only by the
terminal UI. It reuses the engine's Black-Scholes price (`quant_engine.pricing`)
and computes the full Greek set (delta..speed) for the legs of the recommended
structure so the dashboard can show live, animated, color-coded risk.

Nothing here feeds back into signals, sizing or the backtest.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

SQRT2PI = math.sqrt(2.0 * math.pi)


def _phi(x: float) -> float:
    return math.exp(-0.5 * x * x) / SQRT2PI


def _Nc(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


@dataclass
class Greeks:
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0   # per day
    vega: float = 0.0    # per 1 vol point (1%)
    charm: float = 0.0   # dDelta/dt, per day
    vanna: float = 0.0   # dDelta/dVol
    vomma: float = 0.0   # dVega/dVol
    speed: float = 0.0   # dGamma/dSpot

    def scaled(self, qty: float) -> "Greeks":
        return Greeks(*(qty * v for v in self.as_tuple()))

    def __add__(self, o: "Greeks") -> "Greeks":
        return Greeks(*(a + b for a, b in zip(self.as_tuple(), o.as_tuple())))

    def as_tuple(self):
        return (self.delta, self.gamma, self.theta, self.vega,
                self.charm, self.vanna, self.vomma, self.speed)

    def as_dict(self):
        return {"delta": self.delta, "gamma": self.gamma, "theta": self.theta,
                "vega": self.vega, "charm": self.charm, "vanna": self.vanna,
                "vomma": self.vomma, "speed": self.speed}


def option_greeks(spot: float, strike: float, t: float, vol: float,
                  rate: float = 0.066, kind: str = "C") -> Greeks:
    """Black-Scholes Greeks for one option (per 1 unit of underlying).

    t in years, vol decimal. Returns standard greeks; theta/charm per day,
    vega per 1% vol move.
    """
    if t <= 0 or vol <= 0 or spot <= 0 or strike <= 0:
        return Greeks()
    srt = vol * math.sqrt(t)
    d1 = (math.log(spot / strike) + (rate + 0.5 * vol * vol) * t) / srt
    d2 = d1 - srt
    pdf = _phi(d1)
    call = kind.upper().startswith("C")

    delta = _Nc(d1) if call else _Nc(d1) - 1.0
    gamma = pdf / (spot * srt)
    vega = spot * pdf * math.sqrt(t)                       # per 1.00 vol
    # Theta (per year), then per day.
    disc = rate * strike * math.exp(-rate * t)
    if call:
        theta_y = -(spot * pdf * vol) / (2 * math.sqrt(t)) - disc * _Nc(d2)
    else:
        theta_y = -(spot * pdf * vol) / (2 * math.sqrt(t)) + disc * _Nc(-d2)
    # Charm dDelta/dt (per year), then per day.
    charm_y = -pdf * (2 * rate * t - d2 * srt) / (2 * t * srt)
    vanna = -pdf * d2 / vol                                 # dDelta/dVol (per 1.00)
    vomma = vega * (d1 * d2) / vol                          # dVega/dVol
    speed = -gamma / spot * (d1 / srt + 1.0)               # dGamma/dSpot

    return Greeks(
        delta=delta, gamma=gamma,
        theta=theta_y / 365.0,
        vega=vega / 100.0,                                  # per 1% vol
        charm=charm_y / 365.0,
        vanna=vanna / 100.0,
        vomma=vomma / 10000.0,
        speed=speed,
    )


def position_greeks(legs, spot: float, vix: float, t: float, lot_size: int,
                    rate: float = 0.066) -> Greeks:
    """Aggregate Greeks across the recommended structure's legs (× lot size)."""
    total = Greeks()
    vol = vix / 100.0
    for leg in legs:
        g = option_greeks(spot, leg.strike, t, vol, rate, leg.kind)
        total = total + g.scaled(leg.qty * lot_size)
    return total
