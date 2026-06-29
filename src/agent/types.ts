// ════════════════════════════════════════════════════════════════════════
//  AI TRADING RESEARCH AGENT — type contract
// ════════════════════════════════════════════════════════════════════════
//  An INDEPENDENT subsystem. It does NOT generate buy/sell signals. It runs a
//  hedge-fund-style research process: read the regime, form a thesis, gather
//  CONFLUENCE, actively look for DISCONFIRMING evidence (pre-mortem), enforce
//  hard CAPITAL-PRESERVATION gates, grade the setup, size to risk, and LEARN
//  from prior outcomes. VOLARA is treated purely as a data provider — the
//  agent only ever sees a `MarketContext` (the provider boundary), never the
//  raw Snapshot. Every output is deterministic and explainable.
// ════════════════════════════════════════════════════════════════════════

// ── Provider boundary ─────────────────────────────────────────────────────
// The ONLY shape the agent consumes. `provider.ts` adapts a VOLARA Snapshot
// into this; any other data source (CSV, replay, another desk) can populate it.
export interface MarketContext {
  ts: string;
  symbol: string;
  spot: number;

  // trend / regime read (from VOLARA's regime engine)
  regimeState: string;          // NORMAL | TRENDING_UP | TRENDING_DOWN | VOLATILE | NO_GO | EVENT_RISK
  direction: 'UP' | 'DOWN' | 'FLAT';
  trendConfidence: number;      // 0..1
  trendAtr: number;             // ATR as fraction of spot (volatility of trend)

  // volatility
  vix: number;
  vixChg: number;               // change in vol points
  ivRank: number;               // 0..100
  ivPctile: number | null;      // 0..1
  vrp: number | null;           // variance risk premium (IV - HV), vol pts
  expectedMove1d: number;       // expected 1-day move, fraction of spot
  pInside1: number;             // P(spot stays inside 1σ band), 0..1

  // dealer / positioning
  pcr: number;                  // put/call OI ratio
  maxPain: number;
  support: number[];
  resistance: number[];
  gammaFlip: number | null;     // dealer gamma flip level
  gex: number;                  // net gamma exposure (sign matters)

  // book / risk budget
  equity: number;
  portfolioHeat: number;        // 0..1 fraction of risk budget already deployed
  marginUsage: number;          // 0..1

  // data honesty
  chainSynthetic: boolean;      // positioning is synthetic, not live
  dataLive: boolean;            // feed is live vs demo
}

// ── Regime read ───────────────────────────────────────────────────────────
export type MarketCharacter =
  | 'TREND'
  | 'RANGE'
  | 'VOLATILE_EXPANSION'
  | 'COMPRESSION'
  | 'EVENT_DRIVEN'
  | 'UNTRADEABLE';

export type Structure = 'DIRECTIONAL' | 'PREMIUM_SELLING' | 'LONG_VOL' | 'RANGE';

export interface RegimeRead {
  character: MarketCharacter;
  tradeable: boolean;
  description: string;
  favored: Structure[];         // structures the regime rewards
}

// ── Thesis ────────────────────────────────────────────────────────────────
export type Stance = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface Thesis {
  stance: Stance;
  structure: Structure;
  statement: string;            // one-line hypothesis, in a trader's voice
  basis: string[];             // the prior read that motivates it
}

// ── Evidence (the confluence ledger) ──────────────────────────────────────
// Each independent factor reports its ALIGNMENT with the working thesis:
//   align > 0  → corroborates   |   align < 0 → contradicts
// Weight = how much this factor matters; strength is folded into `align`.
export interface EvidenceItem {
  id: string;
  label: string;
  align: number;   // -1..+1
  weight: number;  // 0..1
  detail: string;
}

// ── Pre-mortem (disconfirmation / red-team) ───────────────────────────────
export interface FailureMode {
  scenario: string;
  likelihood: number;  // 0..1
  severity: number;    // 0..1
}
export interface PreMortem {
  failureModes: FailureMode[];
  invalidation: string;   // the concrete event that proves the thesis wrong
  worstCase: string;
}

// ── Risk gates (hard capital-preservation vetoes) ─────────────────────────
export type GateSeverity = 'BLOCK' | 'CAUTION';
export interface RiskGate {
  id: string;
  label: string;
  passed: boolean;
  severity: GateSeverity;   // a failed BLOCK gate vetoes the trade outright
  detail: string;
}

// ── Conviction & setup grade ──────────────────────────────────────────────
export type SetupGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export interface Conviction {
  confluence: number;   // 0..1 weight of corroborating evidence
  dissonance: number;   // 0..1 weight of contradicting evidence
  raw: number;          // 0..100 evidence-only conviction
  memoryAdj: number;    // ± points from the learned prior for this setup
  final: number;        // 0..100 after memory + gate penalties
  grade: SetupGrade;
}

// ── Position sizing (risk-based, conviction-scaled) ───────────────────────
export interface Sizing {
  riskPctEquity: number;  // recommended % of equity to risk
  rupees: number;         // absolute risk budget for the idea
  capped: boolean;        // a constraint clipped the size
  rationale: string;
}

// ── Verdict & the research note (the deliverable) ─────────────────────────
export type Verdict =
  | 'ENGAGE'            // A/B setup, gates clear — act
  | 'SCALE_IN'         // tradeable but with cautions — partial size
  | 'WAIT_FOR_TRIGGER' // thesis valid, entry condition not yet met
  | 'REDUCE_RISK'      // book-level caution dominates
  | 'STAND_ASIDE';     // vetoed or no edge — preserve capital

export interface ResearchNote {
  id: string;
  ts: string;
  symbol: string;
  setupKey: string;        // memory key: character|structure|stance
  regime: RegimeRead;
  thesis: Thesis;
  evidence: EvidenceItem[];
  preMortem: PreMortem;
  gates: RiskGate[];
  conviction: Conviction;
  sizing: Sizing;
  verdict: Verdict;
  headline: string;
  narrative: string[];
  trigger: string;         // what would change my mind / the entry condition
}

// ── Memory & learning ─────────────────────────────────────────────────────
export type Outcome = 'WIN' | 'LOSS' | 'SCRATCH' | 'PENDING';

export interface OutcomeRecord {
  noteId: string;
  ts: string;
  setupKey: string;
  verdict: Verdict;
  conviction: number;
  outcome: Outcome;
  rMultiple: number | null;  // realised reward in R units
  note?: string;
}

// Per-setup learned statistics, Beta-smoothed so small samples stay humble.
export interface SetupStats {
  setupKey: string;
  n: number;            // resolved trades
  wins: number;
  losses: number;
  hitRate: number;      // 0..1 smoothed
  avgR: number;         // mean R across resolved trades
  edge: number;         // -1..+1 confidence-discounted edge
  confidence: number;   // 0..1 how much to trust this prior (sample-driven)
}

// ── Shared helpers ────────────────────────────────────────────────────────
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round = (v: number, dp = 1) => { const m = 10 ** dp; return Math.round(v * m) / m; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
