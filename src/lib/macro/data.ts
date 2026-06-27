// Macro data provider. Pluggable by design: today fast-moving markets are
// modelled (deterministic oscillation), official figures sit at their current
// published levels, and India VIX is the genuine live engine value. Swap this
// module for a real macro feed without touching the engine or UI.

interface LiveInputs {
  vix: number;        // live from the quant engine
  fii?: number;       // ₹Cr (optional live)
  dii?: number;       // ₹Cr
  breadth?: number;   // advance/decline ratio
}

function osc(t: number, base: number, amp: number, freq: number, phase = 0) {
  return base + Math.sin(t * freq + phase) * amp + Math.sin(t * 1.7 + phase) * amp * 0.18;
}

export function macroValues(t: number, live: LiveInputs): Record<string, number> {
  return {
    // FX / rates — market modelled around current levels
    usdinr: osc(t, 83.42, 0.32, 0.18),
    dxy: osc(t, 104.6, 0.7, 0.14, 1.1),
    us10y: osc(t, 4.28, 0.13, 0.12, 0.5),
    repo: 6.5,            // official — RBI on hold
    // commodities
    crude: osc(t, 78.4, 2.1, 0.22, 0.7),
    gold: osc(t, 2318, 16, 0.15, 2.0),
    silver: osc(t, 29.2, 0.5, 0.2, 1.4),
    copper: osc(t, 4.25, 0.06, 0.17, 0.3),
    // growth — official current prints
    gdp: 7.0,
    cpi: 5.1,
    // volatility — LIVE
    vix: live.vix || osc(t, 14, 0.6, 0.3),
    // flows
    fii: live.fii ?? -(820 + Math.sin(t * 0.3) * 950),
    dii: live.dii ?? 1240 + Math.sin(t * 0.25) * 620,
    // breadth
    breadth: live.breadth ?? Math.max(0.4, osc(t, 1.25, 0.45, 0.4)),
  };
}
