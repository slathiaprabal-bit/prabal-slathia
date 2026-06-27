import type { RegimeState } from '../../types';
import type { VolState, VolRegime } from '../vol/types';
import type { RiskSignalInput } from '../risk/types';

// ── Decision Engine — type contract ───────────────────────────────────────
// A composable scoring engine. Each DOMAIN is an independent, pure function that
// consumes the *outputs* of upstream engines (never raw market data) and emits
// a normalised signal. The aggregator fuses weighted signals into a decision.
// Future models (HMM regime, Monte-Carlo, Greeks, ML) register as new domains.

export type DomainKey =
  | 'macro' | 'trend' | 'volatility' | 'breadth' | 'flow' | 'positioning' | 'risk';

export type Direction = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
export type { VolRegime } from '../vol/types';

// Inputs are pre-computed engine outputs — the decision layer never touches
// raw ticks. This keeps every domain unit-testable with plain objects.
export interface DecisionInputs {
  macro: { score: number; confidence: number };            // from Macro engine
  trend: { state: RegimeState; direction: string; confidence: number; trendAtr: number; vixChg: number };
  vol: VolState;                                            // from Volatility engine (interface only)
  breadth: { ad: number; pcr: number };
  flow: { fii: number; dii: number };
  positioning: { pcr: number; maxPain: number; spot: number; support: number[]; resistance: number[]; gammaFlip: number | null };
  risk: RiskSignalInput;   // from the Risk / Portfolio engine
}

export interface DomainResult {
  bias: number;      // -1..+1 directional (bearish..bullish); 0 if non-directional
  selling: number;   // -1..+1 option-selling favourability; 0 if N/A
  strength: number;  // 0..1 conviction in this domain's read
  detail: string;    // human-readable one-liner
  metrics: { label: string; value: string }[];
}

// A domain = what it measures (run) + how much it counts (weight). Both are
// independently replaceable; swap `run` for an ML model without touching others.
export interface Domain {
  key: DomainKey;
  label: string;
  weight: number;
  run: (i: DecisionInputs) => DomainResult;
}

export interface DomainSignal extends DomainResult {
  key: DomainKey;
  label: string;
  weight: number;
}

export interface RecommendedStrategy {
  name: string;
  family: string;
  rationale: string;
}

export interface DecisionOutput {
  direction: Direction;
  directionalScore: number;   // -100..+100
  trendStrength: number;      // 0..100
  volRegime: VolRegime;
  sellingSuitability: number; // 0..100
  confidence: number;         // 0..100
  strategy: RecommendedStrategy;
  signals: DomainSignal[];
  factors: { label: string; bias: number; weight: number }[];
  reasons: string[];
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number) => Math.round(v * 10) / 10;
