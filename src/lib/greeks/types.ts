// ── Greeks Engine — type contract ────────────────────────────────────────
// Per-strike Black-Scholes Greeks across the option chain. Pure math, network
// independent. Feeds the Dealer Positioning engine (GEX / vanna / charm) and is
// consumable by any downstream model.

export interface ChainRowInput {
  strike: number;
  ceOI: number; peOI: number;
  ceIV: number; peIV: number; // in % (e.g. 16.5)
}

export interface GreeksInputs {
  spot: number;
  dte: number;        // days to expiry
  rate: number;       // risk-free (decimal)
  lotSize: number;
  rows: ChainRowInput[];
}

export interface StrikeGreeks {
  strike: number;
  ceOI: number; peOI: number; ceIV: number; peIV: number;
  callDelta: number; putDelta: number;
  callGamma: number; putGamma: number;
  callVega: number; putVega: number;
  callTheta: number; putTheta: number;
  callVanna: number; putVanna: number;
  callCharm: number; putCharm: number;
}

export interface GreeksChain {
  spot: number;
  dte: number;
  rows: StrikeGreeks[];
  atmStrike: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
