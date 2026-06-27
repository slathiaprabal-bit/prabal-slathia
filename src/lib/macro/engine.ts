import { MACRO_INDICATORS, signalOf } from './indicators';
import type { MacroCategory, MacroReading, RegimeScore } from './types';

// Compute per-indicator readings from a value map.
export function computeReadings(values: Record<string, number>): MacroReading[] {
  return MACRO_INDICATORS.map((def) => {
    const value = values[def.key] ?? def.baseline;
    const score = clamp(def.score(value, { baseline: def.baseline }), -1, 1);
    return {
      def,
      value,
      change: value - def.baseline,
      score,
      signal: signalOf(score),
    };
  });
}

// Aggregate readings into an overall Market Regime score (-100..+100) with
// per-category breakdown and an agreement-based confidence.
export function computeRegime(readings: MacroReading[]): RegimeScore {
  const totalW = readings.reduce((s, r) => s + r.def.weight, 0) || 1;
  const net = readings.reduce((s, r) => s + r.def.weight * r.score, 0) / totalW;
  const score = round(net * 100);
  const signal = signalOf(net);
  const label = signal === 'RISK_ON' ? 'RISK-ON' : signal === 'RISK_OFF' ? 'RISK-OFF' : 'NEUTRAL';

  // Category breakdown.
  const cats = new Map<MacroCategory, { sw: number; w: number }>();
  for (const r of readings) {
    const c = cats.get(r.def.category) ?? { sw: 0, w: 0 };
    c.sw += r.def.weight * r.score;
    c.w += r.def.weight;
    cats.set(r.def.category, c);
  }
  const byCategory = [...cats.entries()].map(([category, { sw, w }]) => ({
    category,
    score: w ? sw / w : 0,
    weight: w / totalW,
  })).sort((a, b) => b.weight - a.weight);

  // Confidence = weighted share of indicators agreeing with the net direction,
  // scaled by how decisive the net reading is.
  const dir = Math.sign(net) || 1;
  const agreeW = readings.reduce((s, r) => s + (Math.sign(r.score) === dir ? r.def.weight : 0), 0);
  const agreement = agreeW / totalW; // 0..1
  const decisiveness = Math.min(1, Math.abs(net) / 0.5); // 0..1
  const confidence = round(40 + 45 * agreement + 15 * decisiveness);

  // Top drivers (largest |weighted score|).
  const drivers = [...readings]
    .map((r) => ({ label: r.def.label, score: r.score, weight: r.def.weight / totalW, mag: Math.abs(r.def.weight * r.score) }))
    .sort((a, b) => b.mag - a.mag)
    .slice(0, 4)
    .map(({ label, score, weight }) => ({ label, score, weight }));

  return { score, signal, label, confidence, byCategory, drivers };
}

export function computeMacro(values: Record<string, number>) {
  const readings = computeReadings(values);
  const regime = computeRegime(readings);
  return { readings, regime };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function round(v: number) { return Math.round(v * 10) / 10; }
