// Generate → price → analyze → score like a trader → rank. Reads the Market
// Thesis first (target scenario), then ranks on the five trader priorities with
// existing winners protected. Not a raw objective maximizer.
import { generate, mergeLegs } from './candidates';
import { computeMetrics } from './metrics';
import { analyzeCandidate, buildNorms, componentScores, targetScenario } from './score';
import type { AdjMode, AdjustmentAnalysis, Candidate, Leg, Metrics, OptimizeConfig, Position } from './types';

export interface OptimizeResult {
  baseLegs: Leg[];
  baseMetrics: Metrics;
  candidates: Candidate[];
  evaluated: number;
  mode: AdjMode;
}

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const sgn = (v: number) => (v >= 0 ? '+' : '');
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function optimize(pos: Position, cfg: OptimizeConfig, topK = 6): OptimizeResult {
  const baseMetrics = computeMetrics(pos.legs, [], pos);
  const target = targetScenario(cfg.mode, cfg.thesis, pos);
  const raws = generate(pos);

  // Pass 1 — price + analyze every candidate on a coarse grid.
  type Row = { c: { id: string; label: string; addedLegs: Leg[] }; result: Leg[]; m: Metrics; a: AdjustmentAnalysis };
  const rows: Row[] = [];
  for (const rc of raws) {
    const result = mergeLegs([...pos.legs, ...rc.addedLegs]);
    if (result.length === 0 || result.length > 8) continue;
    const m = computeMetrics(result, rc.addedLegs, pos, 81);
    const a = analyzeCandidate(result, m, baseMetrics, pos, cfg, target);
    rows.push({ c: rc, result, m, a });
  }
  if (rows.length === 0) {
    return { baseLegs: pos.legs, baseMetrics, candidates: [], evaluated: 0, mode: cfg.mode };
  }

  // Pass 2 — normalize across the set, then apply the trader-weighted score.
  const norms = buildNorms(rows, baseMetrics);
  const scored = rows.map((r) => {
    const { breakdown, score } = componentScores(r.a, r.m, baseMetrics, r.c.addedLegs, pos, cfg, norms);
    r.a.breakdown = breakdown;
    return { ...r, score, flagged: r.a.flags.length > 0 };
  });

  // Rank: a flagged (winner-at-risk) adjustment never outranks a clean one (STEP 7).
  scored.sort((x, y) => (x.flagged === y.flagged ? y.score - x.score : x.flagged ? 1 : -1));

  // Surface variety, not ten near-identical strikes of one structure: cap each
  // structure family (kinds × signs) to two entries in the shortlist.
  const famCount = new Map<string, number>();
  const family = (legs: Leg[]) => legs.map((l) => `${l.kind}${l.qty > 0 ? '+' : '-'}${Math.abs(l.qty)}`).sort().join(',');
  const shortlist: typeof scored = [];
  for (const s of scored) {
    const f = family(s.c.addedLegs);
    const n = famCount.get(f) ?? 0;
    if (n >= 2) continue;
    famCount.set(f, n + 1);
    shortlist.push(s);
    if (shortlist.length >= topK) break;
  }

  const candidates: Candidate[] = shortlist.map((s) => {
    const fine = computeMetrics(s.result, s.c.addedLegs, pos, 161);   // fine grid for display
    return {
      id: s.c.id, label: s.c.label, addedLegs: s.c.addedLegs, resultLegs: s.result,
      metrics: fine, analysis: s.a, score: Math.round(s.score * 100), flagged: s.flagged,
      reasoning: reason(cfg, s.a, fine, baseMetrics),
    };
  });

  return { baseLegs: pos.legs, baseMetrics, candidates, evaluated: scored.length, mode: cfg.mode };
}

// Trader-facing rationale — leads with capital preservation + the thesis scenario.
function reason(cfg: OptimizeConfig, a: AdjustmentAnalysis, m: Metrics, b: Metrics): string[] {
  const r: string[] = [];
  const spend = a.premiumPaid > 0 ? `debit ${inr(a.premiumPaid)}` : `credit ${inr(a.adjustCost)}`;

  if (a.expProfitBase > 1) {
    r.push(`Retains ${pct(a.profitRetained)} of the ₹${Math.round(a.expProfitBase).toLocaleString('en-IN')} pinned profit`);
  }

  switch (cfg.mode) {
    case 'CRASH':
      r.push(`${inr(a.scenarioGain)} extra at ${a.scenarioLabel} for ${spend} — efficiency ${a.opportunityEfficiency.toFixed(1)}×`);
      r.push(`Theta ${a.thetaChange >= 0 ? 'held' : 'costs'} ${inr(a.thetaChange)}/d → ${inr(m.theta)}/d`);
      break;
    case 'DEFENSIVE':
      r.push(`POP ${sgn((m.pop - b.pop) * 100)}${((m.pop - b.pop) * 100).toFixed(0)}pts → ${pct(m.pop)}; max loss ${inr(m.maxLoss)}`);
      r.push(`Cuts vega ${inr(a.vegaChange)}/pt, delta ${sgn(a.deltaChange)}${a.deltaChange.toFixed(0)}/pt for ${spend}`);
      break;
    case 'THETA':
      r.push(`Adds ${inr(a.thetaChange)}/d theta → ${inr(m.theta)}/d at ${inr(a.marginChange)} margin`);
      r.push(`Theta/margin ${(m.theta / (m.margin + 1) * 1e5).toFixed(1)} per ₹1L; delta ${m.delta.toFixed(0)}/pt`);
      break;
    case 'VOL':
      r.push(`Long vega ${sgn(a.vegaChange)}${inr(a.vegaChange)}/pt; ${inr(a.scenarioGain)} in a ${a.scenarioLabel} move`);
      r.push(`Positioned for IV expansion for ${spend}; delta ${m.delta.toFixed(0)}/pt`);
      break;
  }

  const b0 = a.breakdown;
  r.push(`Score mix — capital ${pct(b0.capital)} · objective ${pct(b0.objective)} · cost ${pct(b0.cost)} · risk ${pct(b0.risk)} · simple ${pct(b0.simplicity)}`);
  for (const f of a.flags) r.push(`⚠ ${f}`);
  return r;
}
