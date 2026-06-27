// ── Risk / Portfolio Engine — type contract ──────────────────────────────
// Reusable analytics engine. Ingests Greeks + capital + Monte-Carlo outputs and
// exposes ONE typed PortfolioState. Consumers (Decision Engine, Trade Planner,
// Backtester, ML) read PortfolioState — never raw risk numbers.

export interface NetGreeks {
  delta: number;  // ₹ per 1 index point
  gamma: number;  // ₹ per point²
  theta: number;  // ₹ per day
  vega: number;   // ₹ per 1 vol point
  charm: number;
  vanna: number;
  vomma: number;
  speed: number;
}

export interface PortfolioInputs {
  greeks: NetGreeks;        // per-structure (1 lot of the structure)
  lots: number;
  equity: number;
  capitalAtRisk: number;
  marginUsed: number;
  marginUtil: number;       // 0..1
  heat: number;             // 0..1 portfolio heat
  em1d: number;             // 1σ daily expected move (points)
  vix: number;
  spot: number;
  mc: {
    pRuin: number; pDD20: number; medianReturnPct: number;
    expectedDrawdown: number; worstMaxDD: number;
    histCounts: number[]; histEdges: number[];
  };
}

export type Exposure = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface RiskContribution { factor: 'Delta' | 'Gamma' | 'Vega'; pct: number }

export interface PortfolioState {
  greeks: NetGreeks;        // portfolio (× lots)
  lots: number;
  beta: number;             // portfolio beta to the underlying
  dollarDelta: number;      // ₹ per point
  var95: number;            // 1-day 95% Value-at-Risk (₹)
  var99: number;            // 1-day 99% Value-at-Risk (₹)
  varPctEquity: number;     // var95 / equity
  riskContributions: RiskContribution[];
  marginUtil: number;       // 0..1
  heat: number;             // 0..1
  equity: number;
  capitalAtRisk: number;
  marginUsed: number;
  deltaBias: Exposure;
  vegaBias: Exposure;
  mc: {
    pProfit: number; pRuin: number; pDD20: number;
    medianReturnPct: number; expectedDrawdown: number; worstMaxDD: number;
  };
  reasoning: string[];
}

// Minimal slice the Decision Engine's risk domain consumes (interface
// segregation — the decision layer depends only on what it needs).
export interface RiskSignalInput {
  heat: number;
  marginUtil: number;
  pRuin: number;
  varPctEquity: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number) => Math.round(v * 10) / 10;
