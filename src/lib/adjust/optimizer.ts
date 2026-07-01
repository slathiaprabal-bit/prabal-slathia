// Generate → price → score → rank. Produces the top adjustments with reasoning.
import { generate, mergeLegs } from './candidates';
import { computeMetrics } from './metrics';
import { rawScore } from './score';
import type { AdjMode, Candidate, Leg, Metrics, Position, VolContext } from './types';

export interface OptimizeResult {
  baseLegs: Leg[];
  baseMetrics: Metrics;
  candidates: Candidate[];
  evaluated: number;
  mode: AdjMode;
}

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const sgn = (v: number) => (v >= 0 ? '+' : '');

export function optimize(pos: Position, mode: AdjMode, vol: VolContext, topK = 6): OptimizeResult {
  const baseMetrics = computeMetrics(pos.legs, [], pos);
  const raws = generate(pos);

  // Bulk pass on a coarse grid for speed; top-K recomputed on the fine grid.
  const scored: { c: { id: string; label: string; addedLegs: Leg[] }; result: Leg[]; m: Metrics; raw: number }[] = [];
  for (const rc of raws) {
    const result = mergeLegs([...pos.legs, ...rc.addedLegs]);
    if (result.length === 0 || result.length > 8) continue;
    const m = computeMetrics(result, rc.addedLegs, pos, 81);
    const raw = rawScore(mode, m, baseMetrics, pos, vol);
    if (!isFinite(raw)) continue;
    scored.push({ c: rc, result, m, raw });
  }
  if (scored.length === 0) {
    return { baseLegs: pos.legs, baseMetrics, candidates: [], evaluated: 0, mode };
  }

  const rmin = Math.min(...scored.map((s) => s.raw));
  const rmax = Math.max(...scored.map((s) => s.raw));
  const norm = (r: number) => (rmax > rmin ? (100 * (r - rmin)) / (rmax - rmin) : 50);

  scored.sort((a, b) => b.raw - a.raw);
  const candidates: Candidate[] = scored.slice(0, topK).map((s) => ({
    id: s.c.id,
    label: s.c.label,
    addedLegs: s.c.addedLegs,
    resultLegs: s.result,
    metrics: computeMetrics(s.result, s.c.addedLegs, pos, 161),  // fine grid for display
    score: Math.round(norm(s.raw)),
    reasoning: reason(mode, computeMetrics(s.result, s.c.addedLegs, pos, 161), baseMetrics, pos, vol),
  }));

  return { baseLegs: pos.legs, baseMetrics, candidates, evaluated: scored.length, mode };
}

function reason(mode: AdjMode, m: Metrics, b: Metrics, pos: Position, vol: VolContext): string[] {
  const r: string[] = [];
  const dTheta = m.theta - b.theta, dPop = (m.pop - b.pop) * 100, dVega = m.vega - b.vega;
  switch (mode) {
    case 'DEFENSIVE':
      r.push(`Lifts POP to ${(m.pop * 100).toFixed(0)}% (${sgn(dPop)}${dPop.toFixed(0)} pts)`);
      r.push(`Caps max loss at ${inr(m.maxLoss)} (was ${inr(b.maxLoss)})`);
      r.push(`Cuts gamma/vega risk; residual delta ${m.delta.toFixed(0)}/pt`);
      break;
    case 'THETA':
      r.push(`Adds ${inr(dTheta)}/day theta → ${inr(m.theta)}/day total`);
      r.push(`Keeps delta near-neutral (${m.delta.toFixed(0)}/pt)`);
      r.push(`Margin impact ${sgn(m.margin - b.margin)}${inr(m.margin - b.margin)}`);
      break;
    case 'CRASH':
      r.push(`Downside (−${Math.round(m.tailMove)} pts) pays ${inr(m.tailPayoff)} vs ${inr(b.tailPayoff)} now — convex`);
      r.push(`Theta stays ${m.theta >= 0 ? 'positive' : 'negative'} at ${inr(m.theta)}/day`);
      r.push(`Controlled risk: max loss ${inr(m.maxLoss)}, net ${m.adjustCost >= 0 ? 'credit' : 'debit'} ${inr(Math.abs(m.adjustCost))}`);
      break;
    case 'VOL':
      if (vol.expansionExpected) {
        r.push(`Long vega ${inr(m.vega)}/pt (${sgn(dVega)}${inr(dVega)}) into ${vol.driverEvent ?? 'expected IV expansion'}`);
        r.push(`Positioned for pre-event IV bid; delta ${m.delta.toFixed(0)}/pt`);
      } else {
        r.push(`Short vega ${inr(m.vega)}/pt for IV contraction; theta ${inr(m.theta)}/day`);
        r.push(`Harvests rich premium; delta ${m.delta.toFixed(0)}/pt`);
      }
      r.push(`POP ${(m.pop * 100).toFixed(0)}%, margin ${inr(m.margin)}`);
      break;
  }
  return r;
}
