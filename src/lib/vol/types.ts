// ── Volatility Engine — type contract ────────────────────────────────────
// A reusable analytics engine. It ingests every relevant volatility input and
// exposes ONE typed VolState interface. Downstream consumers (Decision Engine,
// Strategy Ranking, Trade Planner, Backtester, Monte-Carlo, HMM, Greeks, ML)
// read VolState only — never raw volatility data.

export type VolRegime = 'VERY_LOW' | 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'EXTREME';
export type VolTrend = 'RISING' | 'STABLE' | 'FALLING';
export type PremiumRichness = 'CHEAP' | 'FAIR' | 'RICH';
export type VegaBias = 'LONG_VEGA' | 'SHORT_VEGA' | 'NEUTRAL_VEGA';

export interface VolInputs {
  atmIv: number;     // ATM implied volatility %
  vix: number;       // India VIX
  vixChg: number;    // VIX % change (trend proxy)
  ivRank: number;    // 0..100
  ivPctile: number;  // 0..100
  hv: number;        // historical / realized volatility %
  vrp: number;       // variance risk premium (IV − HV)
  emExpiry: number;  // expected move to expiry (points)
  emPct: number;     // expected move %
  termSlope: number; // back − front ATM IV (contango > 0, backwardation < 0)
  skew: number;      // call-wing IV − put-wing IV (downside skew < 0)
  pInside1: number;  // probability inside 1σ range (0..1)
}

export interface VolDriver {
  key: string;
  label: string;
  weight: number;        // share of the score
  contribution: number;  // -1..+1 (toward elevated / rich vol)
  detail: string;
}

export interface VolState {
  // headline analytics
  score: number;             // 0..100 volatility score
  regime: VolRegime;
  trend: VolTrend;
  premiumRichness: PremiumRichness;
  expansionProb: number;     // 0..100
  compressionProb: number;   // 0..100
  vegaBias: VegaBias;
  confidence: number;        // 0..100
  drivers: VolDriver[];      // sorted, strongest first
  reasoning: string[];

  // passthrough essentials for downstream engines
  atmIv: number;
  vix: number;
  ivRank: number;
  ivPctile: number;
  hv: number;
  vrp: number;
  emExpiry: number;
  emPct: number;
  termSlope: number;
  skew: number;
  pInside1: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number) => Math.round(v * 10) / 10;
