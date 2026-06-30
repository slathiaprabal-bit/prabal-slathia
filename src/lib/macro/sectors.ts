// Deterministic, rule-based interpretation + sector-impact engine.
// NO LLM. Pure functions: (key, direction) -> a short plain-English read with
// the Indian-market sector implications. This seeds the future Sector Impact
// Engine; add a row to extend coverage.
import type { MacroReading } from './types';

type Dir = 'up' | 'down' | 'flat';

interface Rule { up: string; down: string; flat: string }

const RULES: Record<string, Rule> = {
  usdinr: {
    up: 'Rupee weakening. Tailwind for IT & pharma exporters; headwind for importers, OMCs and capital goods.',
    down: 'Rupee strengthening. Eases import bills and inflation; trims exporter margins.',
    flat: 'Rupee stable. Neutral for trade-exposed sectors.',
  },
  dxy: {
    up: 'Dollar firming. Drains EM liquidity and pressures foreign inflows into Indian equities.',
    down: 'Dollar softening. Supportive of EM flows and risk appetite.',
    flat: 'Dollar range-bound. Flows neutral.',
  },
  us10y: {
    up: 'US yields rising. Tightens global financial conditions; pressures high-duration / growth stocks.',
    down: 'US yields easing. Supports valuations, especially IT and rate-sensitive sectors.',
    flat: 'US yields steady. Discount-rate backdrop unchanged.',
  },
  repo: {
    up: 'RBI tightening. Higher cost of capital weighs on banks’ NIMs tailwinds fade, autos and real estate.',
    down: 'RBI easing. Positive for rate-sensitives — banks, NBFCs, autos, real estate.',
    flat: 'Policy on hold. Rate-sensitive sectors in steady state.',
  },
  crude: {
    up: 'Crude rising. Negative for OMCs, paints, aviation, tyres; widens the import bill and CAD.',
    down: 'Crude falling. Lower inflation pressure; benefits oil-importers, paints, aviation and logistics.',
    flat: 'Crude stable. Import-cost backdrop unchanged.',
  },
  gold: {
    up: 'Gold bid. Safe-haven demand rising — a risk-off tell; supportive for jewellery/financiers on AUM.',
    down: 'Gold easing. Haven demand fading — risk-on signal.',
    flat: 'Gold range-bound. Haven demand neutral.',
  },
  silver: {
    up: 'Silver firm. Industrial + precious demand healthy — mild pro-cyclical signal.',
    down: 'Silver soft. Industrial demand cooling.',
    flat: 'Silver steady.',
  },
  copper: {
    up: 'Copper rising. “Dr. Copper” signals growth — positive for metals, capital goods and infrastructure.',
    down: 'Copper falling. Growth impulse weakening — caution for cyclicals and metals.',
    flat: 'Copper range-bound. Growth signal neutral.',
  },
  gdp: {
    up: 'Growth accelerating. Broadly supportive of cyclicals, banks and consumption.',
    down: 'Growth cooling. Favour defensives over high-beta cyclicals.',
    flat: 'Growth steady.',
  },
  cpi: {
    up: 'Inflation rising. Limits RBI easing room; pressures rate-sensitives and margins.',
    down: 'Inflation cooling. Opens policy space — positive for banks, autos, real estate.',
    flat: 'Inflation in band. Policy backdrop stable.',
  },
  vix: {
    up: 'Volatility rising. Hedging demand up, risk-off — premium buyers favoured.',
    down: 'Volatility falling. Complacency — premium-selling friendly.',
    flat: 'Volatility moderate.',
  },
  fii: {
    up: 'Foreign buying. Supportive of large-caps, banks and index heavyweights.',
    down: 'Foreign selling. Pressure on large-caps and the rupee.',
    flat: 'Foreign flows balanced.',
  },
  dii: {
    up: 'Domestic buying. Cushions large-cap drawdowns; supportive breadth.',
    down: 'Domestic selling. Less downside cushion.',
    flat: 'Domestic flows neutral.',
  },
  breadth: {
    up: 'Breadth broadening. Healthy participation across mid/small-caps.',
    down: 'Breadth narrowing. Rally concentration — a weak-internals warning.',
    flat: 'Breadth mixed.',
  },
};

const ARROW: Record<Dir, string> = { up: '↑', down: '↓', flat: '→' };

// One deterministic interpretation line for a card.
export function interpret(key: string, direction: Dir): string {
  const r = RULES[key];
  if (!r) return '';
  return `${ARROW[direction]} ${r[direction]}`;
}

// Aggregate per-sector tilt across all live readings (seed for the Sector
// Impact Engine / heatmap). Returns sector -> net score in [-1, +1].
const SECTOR_MAP: Record<string, { sector: string; sign: number }[]> = {
  usdinr: [{ sector: 'IT', sign: +1 }, { sector: 'Pharma', sign: +1 }, { sector: 'OMC', sign: -1 }],
  crude: [{ sector: 'OMC', sign: -1 }, { sector: 'Aviation', sign: -1 }, { sector: 'Paints', sign: -1 }],
  us10y: [{ sector: 'IT', sign: -1 }, { sector: 'Realty', sign: -1 }],
  repo: [{ sector: 'Banks', sign: +1 }, { sector: 'Autos', sign: +1 }, { sector: 'Realty', sign: +1 }],
  copper: [{ sector: 'Metals', sign: +1 }, { sector: 'CapGoods', sign: +1 }],
  cpi: [{ sector: 'Banks', sign: +1 }, { sector: 'Autos', sign: +1 }],
};

export function sectorTilts(readings: MacroReading[]): { sector: string; score: number }[] {
  const acc = new Map<string, { s: number; n: number }>();
  for (const r of readings) {
    if (r.score == null) continue;
    const rows = SECTOR_MAP[r.def.key];
    if (!rows) continue;
    for (const { sector, sign } of rows) {
      const cur = acc.get(sector) ?? { s: 0, n: 0 };
      cur.s += sign * r.score;
      cur.n += 1;
      acc.set(sector, cur);
    }
  }
  return [...acc.entries()]
    .map(([sector, { s, n }]) => ({ sector, score: n ? s / n : 0 }))
    .sort((a, b) => b.score - a.score);
}
