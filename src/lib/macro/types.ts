// ── Macro Intelligence — type contract ───────────────────────────────────
// Every macro indicator is a self-describing module: metadata + a pure scoring
// function that maps its value to a risk contribution. Nothing is hardcoded in
// the UI; the workspace renders whatever the registry defines.

export type MacroCategory =
  | 'FX'
  | 'Rates'
  | 'Commodity'
  | 'Growth'
  | 'Volatility'
  | 'Flows'
  | 'Breadth';

export type MacroSignal = 'RISK_ON' | 'NEUTRAL' | 'RISK_OFF';

// Where a value comes from — drives the small provenance tag in the UI.
export type MacroSource = 'live' | 'market' | 'official';

// Institutional-grade transparency: every metric declares exactly how fresh /
// trustworthy its number is. The UI must never silently show stale data.
export type MacroStatus =
  | 'LIVE'          // real-time, fresh
  | 'DELAYED'       // real source but lagged (EOD / 15-min / last-good)
  | 'OFFICIAL'      // authoritative slow print, dated
  | 'MARKET_CLOSED' // last close shown, market shut
  | 'NO_LIVE_DATA'; // fetch failed, no last-good — value is null, never faked

// Full provenance carried from the backend /api/macro payload (+ live VIX).
export interface MacroProvenance {
  value: number | null;
  previous: number | null;
  timestamp: string | null; // ISO of the underlying data point
  freshness: number | null; // age in seconds
  source: string;           // human label, e.g. "Yahoo Finance", "RBI"
  confidence: number;       // 0..1
  status: MacroStatus;
  asof?: string | null;     // official: release date
  nextRelease?: string | null; // official: next scheduled release
}

// Scheduled macro event (Economic Calendar / RBI / FOMC / CPI countdowns).
export interface MacroEvent {
  name: string;
  datetime: string;
  type: string;
  importance: string;
  source: string;
  secondsUntil: number;
}

export interface ScoreCtx {
  baseline: number; // reference level for change / scoring context
}

export interface MacroIndicatorDef {
  key: string;
  label: string;
  category: MacroCategory;
  unit: string;
  source: MacroSource;
  weight: number; // relative weight in the regime score (normalised by engine)
  baseline: number; // current reference level
  precision: number;
  invertChange?: boolean; // true when a HIGHER value is risk-off (red on up)
  format: (v: number) => string;
  // Pure: value (+ context) -> risk contribution in [-1, +1].
  // +1 = unambiguously risk-on (supports risk assets), -1 = risk-off.
  score: (v: number, ctx: ScoreCtx) => number;
  // One-line explanation of the current reading for the decision rationale.
  rationale: (v: number, signal: MacroSignal) => string;
}

export interface MacroReading {
  def: MacroIndicatorDef;
  value: number | null;            // null when status is NO_LIVE_DATA
  previous: number | null;
  change: number | null;           // vs previous (null when no data)
  direction: 'up' | 'down' | 'flat';
  score: number | null;            // -1..+1, null when no data (excluded from regime)
  signal: MacroSignal | null;
  prov: MacroProvenance;           // value/timestamp/source/freshness/status/confidence
  interpretation: string;          // deterministic, rule-based (no LLM)
}

export interface CategoryScore {
  category: MacroCategory;
  score: number; // -1..+1 weighted within category
  weight: number; // share of total weight
}

export interface RegimeScore {
  score: number; // -100..+100
  signal: MacroSignal;
  label: string; // 'RISK-ON' | 'NEUTRAL' | 'RISK-OFF'
  confidence: number; // 0..100 (indicator agreement)
  byCategory: CategoryScore[];
  drivers: { label: string; score: number; weight: number }[]; // top contributors
}
