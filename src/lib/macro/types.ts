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
  value: number;
  change: number; // vs baseline
  score: number; // -1..+1
  signal: MacroSignal;
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
