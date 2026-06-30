import { MACRO_INDICATORS, signalOf } from './indicators';
import { interpret } from './sectors';
import type { MacroCategory, MacroReading, MacroProvenance, RegimeScore } from './types';

// Default provenance for a metric the backend didn't return at all.
function emptyProv(): MacroProvenance {
  return {
    value: null, previous: null, timestamp: null, freshness: null,
    source: '', confidence: 0, status: 'NO_LIVE_DATA',
  };
}

function directionOf(change: number | null): 'up' | 'down' | 'flat' {
  if (change == null || Math.abs(change) < 1e-9) return 'flat';
  return change > 0 ? 'up' : 'down';
}

// Build per-indicator readings from the provenance map (keyed by indicator key).
// Metrics with no value (NO_LIVE_DATA) get a null score and are excluded from
// the regime aggregation — never scored off a fabricated number.
export function computeReadings(provByKey: Record<string, MacroProvenance>): MacroReading[] {
  return MACRO_INDICATORS.map((def) => {
    const prov = provByKey[def.key] ?? emptyProv();
    const hasData = prov.value != null && prov.status !== 'NO_LIVE_DATA';
    const value = hasData ? (prov.value as number) : null;
    const previous = prov.previous;
    const ref = previous != null ? previous : def.baseline;
    const change = value != null ? value - ref : null;
    const direction = directionOf(change);
    const score = value != null ? clamp(def.score(value, { baseline: def.baseline }), -1, 1) : null;
    const signal = score != null ? signalOf(score) : null;
    const interpretation = value != null ? interpret(def.key, direction) : '';
    return { def, value, previous, change, direction, score, signal, prov, interpretation };
  });
}

// Aggregate readings into an overall Market Regime score (-100..+100). Only
// readings with a real score contribute; confidence is scaled down when fewer
// metrics are live (data coverage is part of institutional honesty).
export function computeRegime(readings: MacroReading[]): RegimeScore {
  const scored = readings.filter((r) => r.score != null) as (MacroReading & { score: number })[];
  if (scored.length === 0) {
    return { score: 0, signal: 'NEUTRAL', label: 'NO DATA', confidence: 0, byCategory: [], drivers: [] };
  }
  const totalW = scored.reduce((s, r) => s + r.def.weight, 0) || 1;
  const net = scored.reduce((s, r) => s + r.def.weight * r.score, 0) / totalW;
  const score = round(net * 100);
  const signal = signalOf(net);
  const label = signal === 'RISK_ON' ? 'RISK-ON' : signal === 'RISK_OFF' ? 'RISK-OFF' : 'NEUTRAL';

  const cats = new Map<MacroCategory, { sw: number; w: number }>();
  for (const r of scored) {
    const c = cats.get(r.def.category) ?? { sw: 0, w: 0 };
    c.sw += r.def.weight * r.score;
    c.w += r.def.weight;
    cats.set(r.def.category, c);
  }
  const byCategory = [...cats.entries()].map(([category, { sw, w }]) => ({
    category, score: w ? sw / w : 0, weight: w / totalW,
  })).sort((a, b) => b.weight - a.weight);

  const dir = Math.sign(net) || 1;
  const agreeW = scored.reduce((s, r) => s + (Math.sign(r.score) === dir ? r.def.weight : 0), 0);
  const agreement = agreeW / totalW;
  const decisiveness = Math.min(1, Math.abs(net) / 0.5);
  // Coverage: share of total model weight that is actually live this cycle.
  const modelW = readings.reduce((s, r) => s + r.def.weight, 0) || 1;
  const coverage = totalW / modelW; // 0..1
  const confidence = round((40 + 45 * agreement + 15 * decisiveness) * coverage);

  const drivers = [...scored]
    .map((r) => ({ label: r.def.label, score: r.score, weight: r.def.weight / totalW, mag: Math.abs(r.def.weight * r.score) }))
    .sort((a, b) => b.mag - a.mag)
    .slice(0, 4)
    .map(({ label, score, weight }) => ({ label, score, weight }));

  return { score, signal, label, confidence, byCategory, drivers };
}

export function computeMacro(provByKey: Record<string, MacroProvenance>) {
  const readings = computeReadings(provByKey);
  const regime = computeRegime(readings);
  return { readings, regime };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function round(v: number) { return Math.round(v * 10) / 10; }
