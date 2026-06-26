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

export interface Snapshot {
  ts: string;
  source: string;
  spot: number;
  regime: Regime;
  vol: VolBlock;
  surface: Surface;
  smile: Curve;
  term: Curve;
  greeks: Greeks;
  chain: ChainRow[];
  chainSynthetic: boolean;
  positioning: Positioning;
  risk: Risk;
  montecarlo: MonteCarlo;
  trade: Trade;
}

export type ConnState = 'connecting' | 'live' | 'mock';
