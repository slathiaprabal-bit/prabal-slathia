import type { MacroIndicatorDef, MacroSignal } from './types';

// Linear risk-scorer: returns +1 at `riskOnAt`, -1 at `riskOffAt`, linearly
// interpolated and clamped between. Direction is implied by which threshold is
// higher, so the same helper covers "higher = risk-on" and the inverse.
function lin(v: number, riskOnAt: number, riskOffAt: number): number {
  const t = (v - riskOnAt) / (riskOffAt - riskOnAt); // 0 at riskOn, 1 at riskOff
  return Math.max(-1, Math.min(1, 1 - 2 * t));
}

const inr = (v: number) => `${v >= 0 ? '+' : ''}${(v / 100).toFixed(0)}Cr`;

// Reading thresholds are declarative — tune the regime model here, never in UI.
export const MACRO_INDICATORS: MacroIndicatorDef[] = [
  // ── FX ──
  {
    key: 'usdinr', label: 'USD / INR', category: 'FX', source: 'market', weight: 12,
    baseline: 83.4, precision: 2, invertChange: true, unit: '',
    format: (v) => v.toFixed(2),
    score: (v) => lin(v, 82.5, 84.6), // weak rupee = risk-off
    rationale: (v, s) => `USDINR ${v.toFixed(2)} — ${s === 'RISK_OFF' ? 'rupee weakness pressures risk assets' : s === 'RISK_ON' ? 'rupee strength supportive' : 'rupee stable'}`,
  },
  {
    key: 'dxy', label: 'Dollar Index', category: 'FX', source: 'market', weight: 9,
    baseline: 104.6, precision: 1, invertChange: true, unit: '',
    format: (v) => v.toFixed(1),
    score: (v) => lin(v, 101, 107),
    rationale: (v, s) => `DXY ${v.toFixed(1)} — ${s === 'RISK_OFF' ? 'strong dollar drains EM liquidity' : s === 'RISK_ON' ? 'soft dollar aids inflows' : 'dollar range-bound'}`,
  },
  // ── Rates ──
  {
    key: 'us10y', label: 'US 10Y Yield', category: 'Rates', source: 'market', weight: 10,
    baseline: 4.28, precision: 2, invertChange: true, unit: '%',
    format: (v) => `${v.toFixed(2)}%`,
    score: (v) => lin(v, 3.8, 4.9),
    rationale: (v, s) => `US10Y ${v.toFixed(2)}% — ${s === 'RISK_OFF' ? 'higher yields tighten financial conditions' : s === 'RISK_ON' ? 'easing yields support valuations' : 'yields steady'}`,
  },
  {
    key: 'repo', label: 'RBI Repo Rate', category: 'Rates', source: 'official', weight: 6,
    baseline: 6.5, precision: 2, invertChange: true, unit: '%',
    format: (v) => `${v.toFixed(2)}%`,
    score: (v) => lin(v, 5.5, 7.0),
    rationale: (v, s) => `Repo ${v.toFixed(2)}% — ${s === 'RISK_OFF' ? 'restrictive policy' : s === 'RISK_ON' ? 'accommodative policy' : 'policy on hold'}`,
  },
  // ── Commodity ──
  {
    key: 'crude', label: 'Crude (Brent)', category: 'Commodity', source: 'market', weight: 8,
    baseline: 78.4, precision: 1, invertChange: true, unit: '$',
    format: (v) => `$${v.toFixed(1)}`,
    score: (v) => lin(v, 70, 92), // India imports oil — high crude = risk-off
    rationale: (v, s) => `Crude $${v.toFixed(1)} — ${s === 'RISK_OFF' ? 'elevated oil widens the import bill' : s === 'RISK_ON' ? 'soft oil eases inflation' : 'oil stable'}`,
  },
  {
    key: 'gold', label: 'Gold', category: 'Commodity', source: 'market', weight: 6,
    baseline: 2318, precision: 0, invertChange: true, unit: '$',
    format: (v) => `$${v.toFixed(0)}`,
    score: (v) => lin(v, 2150, 2480), // safe-haven bid = risk-off
    rationale: (v, s) => `Gold $${v.toFixed(0)} — ${s === 'RISK_OFF' ? 'safe-haven demand rising' : s === 'RISK_ON' ? 'haven demand fading' : 'gold range-bound'}`,
  },
  {
    key: 'silver', label: 'Silver', category: 'Commodity', source: 'market', weight: 3,
    baseline: 29.2, precision: 2, unit: '$',
    format: (v) => `$${v.toFixed(2)}`,
    score: (v) => lin(v, 33, 26), // industrial + precious; higher = mild risk-on
    rationale: (v, s) => `Silver $${v.toFixed(2)} — ${s === 'RISK_ON' ? 'industrial demand firm' : s === 'RISK_OFF' ? 'demand softening' : 'silver steady'}`,
  },
  {
    key: 'copper', label: 'Copper', category: 'Commodity', source: 'market', weight: 5,
    baseline: 4.25, precision: 2, unit: '$',
    format: (v) => `$${v.toFixed(2)}`,
    score: (v) => lin(v, 4.7, 3.7), // "Dr. Copper" — high = growth = risk-on
    rationale: (v, s) => `Copper $${v.toFixed(2)} — ${s === 'RISK_ON' ? 'growth impulse intact' : s === 'RISK_OFF' ? 'demand weakening' : 'copper range-bound'}`,
  },
  // ── Growth ──
  {
    key: 'gdp', label: 'GDP Growth', category: 'Growth', source: 'official', weight: 6,
    baseline: 7.0, precision: 1, unit: '%',
    format: (v) => `${v.toFixed(1)}%`,
    score: (v) => lin(v, 7.8, 5.0),
    rationale: (v, s) => `GDP ${v.toFixed(1)}% — ${s === 'RISK_ON' ? 'robust expansion' : s === 'RISK_OFF' ? 'growth cooling' : 'steady growth'}`,
  },
  {
    key: 'cpi', label: 'CPI Inflation', category: 'Growth', source: 'official', weight: 7,
    baseline: 5.1, precision: 1, invertChange: true, unit: '%',
    format: (v) => `${v.toFixed(1)}%`,
    score: (v) => lin(v, 3.8, 6.5),
    rationale: (v, s) => `CPI ${v.toFixed(1)}% — ${s === 'RISK_OFF' ? 'sticky inflation limits easing' : s === 'RISK_ON' ? 'inflation well-behaved' : 'inflation in band'}`,
  },
  // ── Volatility ──
  {
    key: 'vix', label: 'India VIX', category: 'Volatility', source: 'live', weight: 15,
    baseline: 14, precision: 2, invertChange: true, unit: '',
    format: (v) => v.toFixed(2),
    score: (v) => lin(v, 11, 22),
    rationale: (v, s) => `VIX ${v.toFixed(2)} — ${s === 'RISK_OFF' ? 'fear elevated, hedging demand high' : s === 'RISK_ON' ? 'complacent, premium-selling friendly' : 'volatility moderate'}`,
  },
  // ── Flows ──
  {
    key: 'fii', label: 'FII Flow', category: 'Flows', source: 'market', weight: 10,
    baseline: 0, precision: 0, unit: '₹Cr',
    format: inr,
    score: (v) => lin(v, 2500, -2500),
    rationale: (v, s) => `FII ${inr(v)} — ${s === 'RISK_ON' ? 'foreign buying supportive' : s === 'RISK_OFF' ? 'foreign selling pressure' : 'flows balanced'}`,
  },
  {
    key: 'dii', label: 'DII Flow', category: 'Flows', source: 'market', weight: 5,
    baseline: 0, precision: 0, unit: '₹Cr',
    format: inr,
    score: (v) => lin(v, 2500, -1500),
    rationale: (v, s) => `DII ${inr(v)} — ${s === 'RISK_ON' ? 'domestic buying cushions' : s === 'RISK_OFF' ? 'domestic selling' : 'domestic flows neutral'}`,
  },
  // ── Breadth ──
  {
    key: 'breadth', label: 'A/D Ratio', category: 'Breadth', source: 'market', weight: 7,
    baseline: 1.0, precision: 2, unit: '',
    format: (v) => v.toFixed(2),
    score: (v) => lin(v, 1.6, 0.6),
    rationale: (v, s) => `A/D ${v.toFixed(2)} — ${s === 'RISK_ON' ? 'broad participation' : s === 'RISK_OFF' ? 'narrow / weak breadth' : 'mixed breadth'}`,
  },
];

export function signalOf(score: number): MacroSignal {
  return score > 0.25 ? 'RISK_ON' : score < -0.25 ? 'RISK_OFF' : 'NEUTRAL';
}
