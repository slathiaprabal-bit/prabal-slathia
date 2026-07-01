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
  regime: string;
  label: string;     // e.g. "Short Strangle" / "Iron Condor"
}

export type AdjMode = 'DEFENSIVE' | 'THETA' | 'CRASH' | 'VOL';

export interface Metrics {
  theta: number;      // ₹ per day (position)
  delta: number;      // ₹ per 1 pt underlying
  gamma: number;
  vega: number;       // ₹ per 1 vol pt
  pop: number;        // 0..1 probability of profit at expiry
  maxProfit: number;  // ₹, P&L-from-now over the scanned range
  maxLoss: number;    // ₹ (negative)
  margin: number;     // ₹ estimated
  tailPayoff: number; // ₹ P&L at spot −600 at expiry (crash convexity)
  adjustCost: number; // ₹ net debit(−)/credit(+) to enter the adjustment
  breakevens: number[];
}

export interface Candidate {
  id: string;
  label: string;
  addedLegs: Leg[];
  resultLegs: Leg[];
  metrics: Metrics;
  score: number;          // 0..100 (mode-weighted)
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
