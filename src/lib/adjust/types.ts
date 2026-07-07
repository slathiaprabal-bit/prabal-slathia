// Adjustment Strategist — type contract.

export type OptKind = 'C' | 'P';

// qty in lots: >0 long, <0 short.
export interface Leg { kind: OptKind; strike: number; qty: number; }

export interface Position {
  legs: Leg[];
  spot: number;
  iv: number;        // decimal (0.14)
  ivRank: number;    // 0..100
  dte: number;       // calendar days to expiry
  rate: number;      // risk-free decimal
  lotSize: number;
  strikeStep: number;
  instrument: string;
  exchange: string;
  regime: string;
  label: string;     // e.g. "Short Strangle" / "Iron Condor"
}

// A position as loaded by the user (broker import / open existing / manual).
export type PositionSource = 'BROKER' | 'STRATEGY_LAB' | 'MANUAL';
// qty in lots (>0 long / <0 short). entry = avg fill price (optional).
// expiry = per-leg expiry date (YYYY-MM-DD) for calendars/diagonals; when
// absent the position's single expiry is assumed.
export interface LoadedLeg { kind: OptKind; strike: number; qty: number; entry?: number; expiry?: string; }
export interface LoadedPosition {
  instrument: string;
  legs: LoadedLeg[];
  label: string;
  source: PositionSource;
  spot?: number;     // explicit (manual) override
  iv?: number;       // explicit (manual) override, in vol points
}

export type AdjMode = 'DEFENSIVE' | 'THETA' | 'CRASH' | 'VOL';

// STEP 1 — the trader's market thesis. The primary constraint the engine reads
// BEFORE ranking: it defines the target scenario adjustments are optimized for.
export type MarketThesis =
  | 'STRONG_BEARISH' | 'MILD_BEARISH' | 'NEUTRAL' | 'MILD_BULLISH'
  | 'STRONG_BULLISH' | 'VOL_EXPANSION' | 'THETA_DECAY' | 'NO_VIEW';

// STEP 3 — how much current profit the trader will spend for convexity.
export type Aggressiveness = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export interface OptimizeConfig {
  mode: AdjMode;
  thesis: MarketThesis;
  aggressiveness: Aggressiveness;
  vol: VolContext;
  retainThreshold: number;        // flag when expiry profit drops > this (default 0.30)
  preferBoughtProtection: boolean; // Defensive: user opts to pay premium for protection
}

// STEP 5/7/8 — the institutional read on a single adjustment, relative to the
// current position and the trader's target scenario.
export interface AdjustmentAnalysis {
  adjustCost: number;            // credit(+) / debit(-) ₹
  premiumPaid: number;           // ₹ paid (0 when a credit)
  marginChange: number;          // ₹ vs current
  thetaChange: number;           // ₹/day vs current
  vegaChange: number;            // ₹/pt vs current
  deltaChange: number;           // ₹/pt vs current
  expProfitBase: number;         // ₹ expiry profit if pinned at spot — current
  expProfitAfter: number;        // ₹ expiry profit if pinned at spot — adjusted
  profitRetained: number;        // ratio, 1 = fully retained
  scenarioGain: number;          // ₹ extra profit in the thesis target scenario
  directionalProtect: number;    // ₹ asymmetric help toward the threatened side (credit cancels out)
  scenarioLabel: string;         // e.g. "−2σ (−512)"
  opportunityEfficiency: number; // scenarioGain ÷ premium (floored)
  breakdown: { capital: number; objective: number; cost: number; risk: number; simplicity: number };
  flags: string[];               // winner-at-risk / constraint warnings
}

export interface Metrics {
  theta: number;      // ₹ per day (position)
  delta: number;      // ₹ per 1 pt underlying
  gamma: number;
  vega: number;       // ₹ per 1 vol pt
  pop: number;        // 0..1 probability of profit at expiry
  maxProfit: number;  // ₹, P&L-from-now over the scanned range
  maxLoss: number;    // ₹ (negative)
  margin: number;     // ₹ estimated
  tailPayoff: number; // ₹ P&L at a ~2σ downside move at expiry (crash convexity)
  tailMove: number;   // the downside move used (points), instrument-scaled
  adjustCost: number; // ₹ net debit(−)/credit(+) to enter the adjustment
  breakevens: number[];
}

export interface Candidate {
  id: string;
  label: string;
  addedLegs: Leg[];
  resultLegs: Leg[];
  metrics: Metrics;
  analysis: AdjustmentAnalysis;
  score: number;          // 0..100 (institutional trader-weighted)
  flagged: boolean;       // winner-at-risk — never ranked #1 over a clean option
  reasoning: string[];
}

export interface VolContext {
  expansionExpected: boolean;   // scheduled macro event within DTE, or low IV rank
  contractionExpected: boolean; // rich IV / post-event
  driverEvent: string | null;   // name of the nearest high-impact event within DTE
  hoursToEvent: number | null;
}

export interface OptimizeInput {
  position: Position;
  mode: AdjMode;
  vol: VolContext;
}

// A single cell of the scenario grid: P&L-from-now for a structure.
export interface ScenarioResult {
  priceMovePct: number;
  pnl: number;
}
