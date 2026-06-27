import type { VolRegime } from '../vol/types';

// ── Strategy Ranking Engine — type contract ──────────────────────────────
// Consumes the Decision Engine output + VolState and ranks a catalog of option
// structures by fit. Closes the Decision Engine → Strategy Ranking chain.

export type Bias = 'BULL' | 'NEUTRAL' | 'BEAR';
export type Vega = 'SHORT' | 'LONG' | 'NEUTRAL';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface StrategyArchetype {
  key: string;
  name: string;
  family: string;
  bias: Bias;
  volFit: VolRegime[];   // regimes the structure is built for
  vega: Vega;
  risk: RiskTier;
  definedRisk: boolean;
  note: string;
}

export interface RankedStrategy {
  key: string;
  name: string;
  family: string;
  bias: Bias;
  vega: Vega;
  risk: RiskTier;
  score: number;          // 0..100 fit
  reasons: string[];
  recommended: boolean;   // matches the Decision Engine's pick
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
