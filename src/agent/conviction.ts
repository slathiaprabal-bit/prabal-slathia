import type {
  MarketContext, Thesis, EvidenceItem, RiskGate, Conviction, SetupGrade, Sizing, SetupStats,
} from './types';
import { clamp, round } from './types';
import { hasBlock, cautionCount } from './gates';

// ════════════════════════════════════════════════════════════════════════
//  STEP 6 — CONVICTION & SETUP GRADE
//  Conviction is the weighted CONSENSUS of evidence, penalised by dissonance,
//  nudged by what has historically worked for this setup (memory), and capped
//  by the risk gates. Only A/B setups earn capital. This is deliberately hard
//  to satisfy — the cost of a missed trade is far lower than a bad one.
// ════════════════════════════════════════════════════════════════════════

export function scoreConviction(
  evidence: EvidenceItem[], gates: RiskGate[], stats: SetupStats,
): Conviction {
  const totalW = evidence.reduce((s, e) => s + e.weight, 0) || 1;
  const confluence = evidence.reduce((s, e) => s + e.weight * Math.max(e.align, 0), 0) / totalW; // 0..1
  const dissonance = evidence.reduce((s, e) => s + e.weight * Math.max(-e.align, 0), 0) / totalW; // 0..1

  // Evidence-only conviction. Confluence is a weighted average of POSITIVE
  // alignments, so even broad agreement rarely exceeds ~0.65; the 1.3 gain maps
  // a near-unanimous, low-dissonance read into A/B territory, while every unit
  // of contradiction is penalised harder than it helps (capital preservation
  // bias — a single strong objection should veto, not average away).
  const raw = clamp(100 * (1.3 * confluence - 0.95 * dissonance), 0, 100);

  // Memory: shift toward the learned edge for this setup (bounded ±15 pts).
  const memoryAdj = round(clamp(stats.edge * 15, -15, 15));

  // Gate penalties: each unresolved CAUTION shaves conviction; a BLOCK floors it.
  const cautionPenalty = cautionCount(gates) * 8;
  let final = raw + memoryAdj - cautionPenalty;
  if (hasBlock(gates)) final = Math.min(final, 18); // a hard veto cannot be a high-conviction idea
  final = round(clamp(final, 0, 100));

  return { confluence: round(confluence, 2), dissonance: round(dissonance, 2), raw: round(raw), memoryAdj, final, grade: grade(final) };
}

function grade(final: number): SetupGrade {
  if (final >= 80) return 'A';
  if (final >= 65) return 'B';
  if (final >= 50) return 'C';
  if (final >= 35) return 'D';
  return 'F';
}

// ════════════════════════════════════════════════════════════════════════
//  STEP 7 — RISK-BASED SIZING
//  Size is a function of conviction and free risk budget, then HARD-CAPPED.
//  A great setup in a hot book still gets small. Capital preservation always
//  wins ties. The base risk-per-idea ceiling scales down in volatile regimes.
// ════════════════════════════════════════════════════════════════════════

export function sizePosition(ctx: MarketContext, c: Conviction, blocked: boolean): Sizing {
  if (blocked || c.grade === 'F' || c.grade === 'D') {
    return { riskPctEquity: 0, rupees: 0, capped: true,
      rationale: blocked ? 'A blocking gate vetoes the trade — zero size.' : `Setup grade ${c.grade} is below the B-grade action threshold — no size.` };
  }

  // Base ceiling per idea: 2% normally, 1% when vol is elevated.
  const volElevated = ctx.ivRank >= 60 || ctx.vix >= 18;
  const ceiling = volElevated ? 1.0 : 2.0;

  // Scale within the ceiling by conviction above the 50 floor.
  const convScale = clamp((c.final - 50) / 50, 0, 1);
  let riskPct = ceiling * (0.4 + 0.6 * convScale); // never below 40% of ceiling once we act

  // Free-budget cap: never consume more than the remaining heat headroom.
  const headroom = clamp(0.8 - ctx.portfolioHeat, 0, 0.8); // budget room as fraction
  const budgetCapPct = headroom * 100 * 0.25;              // spend at most ¼ of remaining room
  const capped = riskPct > budgetCapPct;
  riskPct = Math.min(riskPct, budgetCapPct);

  riskPct = round(clamp(riskPct, 0, ceiling), 2);
  const rupees = Math.round((ctx.equity || 0) * riskPct / 100);

  return {
    riskPctEquity: riskPct,
    rupees,
    capped,
    rationale: capped
      ? `Sized down to ${riskPct.toFixed(2)}% — heat headroom (${(headroom * 100).toFixed(0)}%) caps the idea below its conviction-implied size.`
      : `Risk ${riskPct.toFixed(2)}% of equity — conviction ${c.final.toFixed(0)}/100 within a ${ceiling.toFixed(1)}% ${volElevated ? 'vol-reduced ' : ''}ceiling.`,
  };
}
