// ── Trade Journal Intelligence — type contract ───────────────────────────
// Reusable post-trade analytics engine. Ingests TradeRecords and exposes ONE
// typed JournalState. The seed dataset is pluggable — swap for a real journal /
// broker fills DB without touching the engine, detectors or UI.

export type Direction = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
export type ExitReason = 'TARGET' | 'STOP' | 'TIME' | 'MANUAL_EARLY' | 'MANUAL_LATE' | 'ADJUSTED';

// Raw facts of a closed trade. Behaviour/mistakes are DERIVED, not stored.
export interface TradeRecord {
  id: string;
  date: string;            // ISO date
  strategy: string;        // e.g. 'Iron Condor'
  direction: Direction;
  regimeAtEntry: string;
  pnl: number;             // ₹ realised
  risk: number;            // ₹ planned max risk
  rMultiple: number;       // pnl / risk
  exitReason: ExitReason;
  holdingDays: number;
  plannedHoldDays: number;
  maeR: number;            // max adverse excursion (in R)
  mfeR: number;            // max favourable excursion (in R)
  sizeLots: number;
  baselineLots: number;    // trader's typical size
  followedPlan: boolean;
  precededByLoss: boolean;
}

export type BiasSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface BiasFlag {
  key: string;
  label: string;           // e.g. 'Revenge Trading'
  severity: BiasSeverity;
  count: number;           // occurrences
  evidence: string;        // human explanation
  tradeIds: string[];
}

export interface TradeAnalysis {
  id: string;
  executionScore: number;  // 0..100
  flags: string[];         // per-trade issues
  note: string;            // AI one-liner
}

export interface JournalStats {
  count: number;
  winRate: number;         // 0..1
  expectancyR: number;     // avg R per trade
  avgWinR: number;
  avgLossR: number;
  profitFactor: number;    // gross win / gross loss
  totalPnl: number;        // ₹
  planAdherence: number;   // 0..1
  avgHoldDays: number;
}

export interface JournalState {
  trades: TradeRecord[];
  stats: JournalStats;
  biases: BiasFlag[];
  analyses: TradeAnalysis[];
  suggestions: string[];
  executionScore: number;  // overall 0..100
  emotionalScore: number;  // overall discipline 0..100
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number) => Math.round(v * 10) / 10;
