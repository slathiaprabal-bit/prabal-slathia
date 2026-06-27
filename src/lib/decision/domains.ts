import type { Domain } from './types';
import { clamp } from './types';

// Each domain is a pure, independently testable & replaceable scorer.
// It reads ONLY pre-computed engine outputs (DecisionInputs), never raw data.

// ── MACRO ── consumes the Macro engine's regime score ──────────────────────
export const macroDomain: Domain = {
  key: 'macro', label: 'Macro', weight: 0.16,
  run: (i) => {
    const bias = clamp(i.macro.score / 100, -1, 1);
    const strength = clamp(i.macro.confidence / 100, 0, 1);
    // Decisive macro favours directional structures over neutral premium-selling.
    const selling = clamp(1 - 2 * Math.abs(bias), -1, 1) * 0.5;
    return {
      bias, selling, strength,
      detail: `Macro regime ${i.macro.score > 0 ? '+' : ''}${i.macro.score.toFixed(0)} at ${i.macro.confidence.toFixed(0)}% confidence`,
      metrics: [
        { label: 'Regime', value: `${i.macro.score > 0 ? '+' : ''}${i.macro.score.toFixed(0)}` },
        { label: 'Conf', value: `${i.macro.confidence.toFixed(0)}%` },
      ],
    };
  },
};

// ── TREND ── consumes the quant engine's regime classification ─────────────
export const trendDomain: Domain = {
  key: 'trend', label: 'Trend', weight: 0.22,
  run: (i) => {
    const t = i.trend;
    const dir = t.state === 'TRENDING_UP' ? 1
      : t.state === 'TRENDING_DOWN' || t.state === 'NO_GO' ? -1
      : t.state === 'VOLATILE' || t.state === 'EVENT_RISK' ? -0.25 : 0;
    const mag = clamp(0.35 + Math.abs(t.trendAtr) * 0.4 + t.confidence / 250, 0, 1);
    const bias = clamp(dir * mag, -1, 1);
    const strength = clamp(t.confidence / 100, 0, 1);
    // Range/low-conviction trend favours premium-selling; strong trend less so.
    const selling = clamp(0.5 - Math.abs(bias) * 0.9, -1, 1);
    return {
      bias, selling, strength,
      detail: `${t.state.replace(/_/g, ' ')} regime, ${t.confidence.toFixed(0)}% confidence (ATR trend ${t.trendAtr.toFixed(2)})`,
      metrics: [
        { label: 'State', value: t.state.replace(/_/g, ' ') },
        { label: 'Conf', value: `${t.confidence.toFixed(0)}%` },
      ],
    };
  },
};

// ── VOLATILITY ── consumes the vol-state engine output ─────────────────────
export const volatilityDomain: Domain = {
  key: 'volatility', label: 'Volatility', weight: 0.14,
  run: (i) => {
    const v = i.vol;
    const ivr = v.ivRank ?? 50;
    const vrp = v.vrp ?? 0;
    // Premium-selling edge: rich IV rank + positive variance risk premium.
    const selling = clamp((ivr - 50) / 50 * 0.7 + clamp(vrp / 8, -1, 1) * 0.5, -1, 1);
    // High vol carries a mild risk-off directional tilt.
    const bias = clamp(-(v.vix - 15) / 22 * 0.35, -1, 1);
    const strength = clamp(0.45 + Math.abs(ivr - 50) / 100, 0, 1);
    return {
      bias, selling, strength,
      detail: `IV Rank ${ivr.toFixed(0)}, VRP ${vrp >= 0 ? '+' : ''}${vrp.toFixed(1)} — premium ${selling > 0.2 ? 'rich' : selling < -0.2 ? 'cheap' : 'fair'}`,
      metrics: [
        { label: 'IVR', value: ivr.toFixed(0) },
        { label: 'VRP', value: `${vrp >= 0 ? '+' : ''}${vrp.toFixed(1)}` },
      ],
    };
  },
};

// ── BREADTH ── consumes Macro engine A/D + positioning PCR ─────────────────
export const breadthDomain: Domain = {
  key: 'breadth', label: 'Breadth', weight: 0.12,
  run: (i) => {
    const ad = i.breadth.ad;
    const bias = clamp((ad - 1) / 0.6, -1, 1);
    const strength = clamp(Math.abs(ad - 1) / 0.6, 0, 1);
    return {
      bias, selling: 0, strength,
      detail: `Advance/decline ${ad.toFixed(2)} — ${ad > 1.15 ? 'broad participation' : ad < 0.85 ? 'narrow / weak' : 'mixed'}`,
      metrics: [{ label: 'A/D', value: ad.toFixed(2) }],
    };
  },
};

// ── OPTIONS FLOW ── consumes Macro engine FII/DII flow ─────────────────────
export const flowDomain: Domain = {
  key: 'flow', label: 'Options Flow', weight: 0.12,
  run: (i) => {
    const net = i.flow.fii * 0.7 + i.flow.dii * 0.3; // ₹Cr-scaled
    const bias = clamp(net / 3000, -1, 1);
    const strength = clamp(Math.abs(net) / 3000, 0, 1);
    return {
      bias, selling: 0, strength,
      detail: `FII ${fmtCr(i.flow.fii)} / DII ${fmtCr(i.flow.dii)} — ${bias > 0.15 ? 'net buying' : bias < -0.15 ? 'net selling' : 'balanced'}`,
      metrics: [
        { label: 'FII', value: fmtCr(i.flow.fii) },
        { label: 'DII', value: fmtCr(i.flow.dii) },
      ],
    };
  },
};

// ── POSITIONING ── consumes the positioning engine output ──────────────────
export const positioningDomain: Domain = {
  key: 'positioning', label: 'Positioning', weight: 0.14,
  run: (i) => {
    const p = i.positioning;
    const pcrBias = clamp((p.pcr - 1) / 0.3, -1, 1); // put-heavy = contrarian bullish
    const pull = p.spot ? clamp((p.maxPain - p.spot) / (p.spot * 0.01), -1, 1) : 0;
    const bias = clamp(pcrBias * 0.6 + pull * 0.4, -1, 1);
    const strength = clamp((Math.abs(pcrBias) + Math.abs(pull)) / 2, 0, 1);
    // Range-bound (PCR≈1, spot≈max-pain) favours defined-risk premium selling.
    const range = 1 - Math.min(1, Math.abs(p.pcr - 1) / 0.4 + Math.abs(pull) * 0.5);
    const selling = clamp(range * 2 - 1, -1, 1);
    return {
      bias, selling, strength,
      detail: `PCR ${p.pcr.toFixed(2)}, max-pain ${Math.round(p.maxPain).toLocaleString('en-IN')} vs spot — ${pull > 0.1 ? 'upward magnet' : pull < -0.1 ? 'downward magnet' : 'pinned'}`,
      metrics: [
        { label: 'PCR', value: p.pcr.toFixed(2) },
        { label: 'Max Pain', value: Math.round(p.maxPain).toLocaleString('en-IN') },
      ],
    };
  },
};

// ── RISK ── consumes the risk/sizing engine output (gates suitability) ─────
export const riskDomain: Domain = {
  key: 'risk', label: 'Risk', weight: 0.10,
  run: (i) => {
    const r = i.risk;
    const load = clamp(r.heat / 0.05 * 0.4 + r.margin / 0.6 * 0.3 + r.pRuin / 0.05 * 0.3, 0, 1.5);
    const selling = clamp(1 - load * 1.4, -1, 1); // capacity to add premium risk
    const strength = clamp(0.5 + load * 0.3, 0, 1);
    return {
      bias: 0, selling, strength,
      detail: `Heat ${(r.heat * 100).toFixed(1)}%, margin ${(r.margin * 100).toFixed(0)}%, P(ruin) ${(r.pRuin * 100).toFixed(1)}% — ${load < 0.5 ? 'capacity to deploy' : load < 1 ? 'measured capacity' : 'risk budget stretched'}`,
      metrics: [
        { label: 'Heat', value: `${(r.heat * 100).toFixed(1)}%` },
        { label: 'P(ruin)', value: `${(r.pRuin * 100).toFixed(1)}%` },
      ],
    };
  },
};

function fmtCr(v: number) { return `${v >= 0 ? '+' : ''}${(v / 100).toFixed(0)}Cr`; }

// Registry — the aggregator iterates this. Add HMM / Monte-Carlo / Greeks / ML
// domains here without touching the engine.
export const DOMAINS: Domain[] = [
  macroDomain, trendDomain, volatilityDomain, breadthDomain,
  flowDomain, positioningDomain, riskDomain,
];
