// ── Dealer Positioning Engine — type contract ────────────────────────────
// Institutional dealer-gamma analytics (GEX profile, gamma flip, vanna/charm
// exposure, max pain, OI walls) computed from the per-strike Greeks chain.

export interface GexPoint { strike: number; gex: number }

export type GammaRegime = 'LONG_GAMMA' | 'SHORT_GAMMA';

export interface DealerState {
  spot: number;
  profile: GexPoint[];        // per-strike dealer gamma exposure (₹/1% move)
  netGex: number;             // ₹ net
  gammaFlip: number | null;   // spot level where dealer gamma flips sign
  vannaExposure: number;      // ₹ (dVega/dSpot proxy via vanna·OI)
  charmExposure: number;      // ₹ (dDelta/dt via charm·OI)
  maxPain: number;            // OI-weighted max-pain strike
  callWall: number;           // largest call-OI strike (resistance)
  putWall: number;            // largest put-OI strike (support)
  gammaRegime: GammaRegime;
  reasoning: string[];
}
