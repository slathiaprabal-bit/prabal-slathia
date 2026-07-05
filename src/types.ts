// Snapshot schema — mirrors api/serializers.build_snapshot output.
// The backend is the source of truth; these types are the contract.

export type RegimeState =
  | 'NORMAL'
  | 'TRENDING_UP'
  | 'TRENDING_DOWN'
  | 'VOLATILE'
  | 'NO_GO'
  | 'EVENT_RISK';

export interface Regime {
  state: RegimeState;
  engineRegime: string;
  confidence: number;
  direction: string;
  vix: number;
  vixChg: number;
  trendAtr: number;
  note: string;
  trade: boolean;
}

export interface VolBlock {
  vix: number;
  ivRank: number;
  ivPctile: number | null;
  hv20: number | null;
  vrp: number | null;
  em1d: number;
  emExpiry: number;
  sigma1: [number, number];
  sigma2: [number, number];
  pInside1: number;
}

export interface Surface {
  strikes: number[];
  expiries: number[];
  iv: number[][]; // [expiry][strike]
  live: boolean;
}

export interface Curve {
  strikes?: number[];
  dte?: number[];
  iv: number[];
}

// Real day-over-day IV memory (backend api/volhistory.py). Fields are null
// until real prior-day observations exist — never fabricated.
export interface VolHistory {
  yesterdayDate: string | null;
  days: number;
  smileYesterday: number[] | null;   // aligned to today's smile strikes
  smileAvg5: number[] | null;
  surfaceYesterday: number[][] | null; // aligned to today's surface grid
  tenors: {
    labels: string[];                // 1W 2W 1M 2M 3M 6M
    dte: number[];
    today: (number | null)[];        // null = beyond observed DTE range
    yesterday: (number | null)[] | null;
    avg5: (number | null)[] | null;
  };
}

// One intraday replay sample (api/volreplay.py) — enough to re-render the
// smile, term structure, surface and vol engine at that recorded moment.
export interface ReplaySample {
  ts: string;
  t: string;    // HH:MM IST
  spot: number;
  vixChg: number;
  vol: { vix: number; ivRank: number; ivPctile: number; hv20: number; vrp: number; emExpiry: number; pInside1: number };
  smile: Curve;
  term: Curve;
  surface: Surface;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  charm: number;
  vanna: number;
  vomma: number;
  speed: number;
}

export interface ChainRow {
  strike: number;
  ceOI: number;
  peOI: number;
  ceIV: number;
  peIV: number;
}

export interface Positioning {
  maxPain: number;
  pcr: number;
  support: number[];
  resistance: number[];
  gex: number;
  gammaFlip: number | null;
  synthetic: boolean;
}

export interface Risk {
  equity: number;
  capitalAtRisk: number;
  portfolioHeat: number;
  marginUsed: number;
  marginUsage: number;
  lots: number;
  kellyLots: number;
  kellyPct: number;
  probRuin?: number;
  expectedDrawdown?: number;
  medianMaxDD?: number;
  worstMaxDD?: number;
}

export interface MonteCarlo {
  startCapital?: number;
  pRuin?: number;
  pDD10?: number;
  pDD20?: number;
  medianMaxDD?: number;
  worstMaxDD?: number;
  expectedDrawdown?: number;
  finalP05?: number;
  finalP50?: number;
  finalP95?: number;
  medianReturnPct?: number;
  hist?: { counts: number[]; edges: number[] };
  cone?: { p05: number[]; p50: number[]; p95: number[] };
  samplePaths?: number[][];
}

export interface Trade {
  decision: 'TRADE' | 'NO_TRADE';
  confidence: number;
  edgeScore: number;
  premiumRichness: number;
  structure: string;
  expectedReturn: number;
  maxLoss: number;
  tailRisk: number;
  shortPut: number | null;
  shortCall: number | null;
  takeProfit: number;
  stopLoss: number;
  creditPerLot: number;
  reasons: string[];
  rejectReasons: string[];
}

export interface History {
  returns: number[]; // daily log returns (%)
  vix: number[];
}

export interface BacktestStats {
  totalReturnPct: number | null;
  totalPnl: number | null;
  trades: number | null;
  winRatePct: number | null;
  profitFactor: number | null;
  maxDrawdownPct: number | null;
  sharpe: number | null;
  finalEquity: number | null;
  sourceCapital: number | null;
}

export interface Backtest {
  stats: BacktestStats;
  equity: { equity: number; drawdown: number }[];
}

export interface IndexQuote {
  value: number | null;
  chg: number | null;
}

export interface Secondary {
  banknifty: IndexQuote;
  sensex: IndexQuote;
  finnifty: IndexQuote;
}

export interface Snapshot {
  ts: string;
  source: string;
  spot: number;
  regime: Regime;
  vol: VolBlock;
  surface: Surface;
  surfaceModel?: Surface | null;   // smooth parametric fit, served alongside the live surface
  smile: Curve;
  term: Curve;
  volHistory?: VolHistory | null;
  greeks: Greeks;
  chain: ChainRow[];
  chainSynthetic: boolean;
  positioning: Positioning;
  risk: Risk;
  montecarlo: MonteCarlo;
  trade: Trade;
  strategies: StrategyRanking;
  history?: History;
  backtest?: Backtest;
  secondary?: Secondary;
}

export interface StrategyCandidate {
  code: string;
  name: string;
  category: string;
  score: number;
  confidence: number;
  ev: number;
  pop: number;
  maxGain: number;
  maxLoss: number;
  rrRatio: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  directional: 'bull' | 'bear' | 'neutral';
  reasoning: string[];
  ranked: number;
}

export interface StrategyRanking {
  top3: StrategyCandidate[];
  totalScored: number;
  marketCondition: string;
  allScores: Record<string, number>;
}

// 8 institutional workspaces — the sidebar navigation contract.
export type WorkspaceId =
  | 'volatility'
  | 'events'
  | 'adjust'
  | 'strategy'
  | 'risk'
  | 'breadth'
  | 'macro'
  | 'portfolio'
  | 'journal'
  | 'research'
  | 'settings';

export type ConnState = 'connecting' | 'live' | 'mock' | 'error';

export interface BackendError {
  error: string;
  type?: string;
  origin?: string;
  traceback?: string;
  failing_stage?: string;
  stage_inputs?: Record<string, string>;
  where?: string;
}
