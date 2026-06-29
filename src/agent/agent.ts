import type {
  MarketContext, ResearchNote, Verdict, RiskGate, Conviction, Thesis, RegimeRead, EvidenceItem, PreMortem, Sizing,
} from './types';
import { readRegime } from './regime';
import { formThesis } from './thesis';
import { gatherEvidence } from './evidence';
import { runPreMortem } from './premortem';
import { runGates, hasBlock, cautionCount } from './gates';
import { scoreConviction, sizePosition } from './conviction';
import { statsFor, type MemoryStore } from './memory';

// ════════════════════════════════════════════════════════════════════════
//  THE RESEARCH AGENT — orchestrator
//  Runs the full discretionary-research pipeline over a MarketContext and
//  emits a single ResearchNote. The verdict is the END of a deliberation, not
//  a signal: regime → thesis → confluence → pre-mortem → gates → conviction →
//  sizing → verdict, each step able to veto or downgrade the next.
// ════════════════════════════════════════════════════════════════════════

export function research(ctx: MarketContext, memory?: MemoryStore): ResearchNote {
  const regime = readRegime(ctx);
  const thesis = formThesis(ctx, regime);
  const setupKey = `${regime.character}|${thesis.structure}|${thesis.stance}`;

  const evidence = gatherEvidence(ctx, thesis);
  const preMortem = runPreMortem(ctx, thesis, evidence);
  const gates = runGates(ctx, regime, thesis);

  const stats = statsFor(setupKey, memory);
  const conviction = scoreConviction(evidence, gates, stats);
  const blocked = hasBlock(gates);
  const sizing = sizePosition(ctx, conviction, blocked);

  const verdict = decideVerdict(ctx, regime, conviction, gates, sizing);
  const trigger = entryTrigger(ctx, thesis, verdict);

  return {
    id: noteId(ctx),
    ts: ctx.ts || new Date().toISOString(),
    symbol: ctx.symbol,
    setupKey,
    regime, thesis, evidence, preMortem, gates, conviction, sizing, verdict,
    headline: headline(verdict, thesis, conviction),
    narrative: narrate(ctx, regime, thesis, evidence, preMortem, gates, conviction, sizing, verdict, stats),
    trigger,
  };
}

// ── Verdict: the disciplined translation of conviction + gates into action ──
function decideVerdict(
  ctx: MarketContext, regime: RegimeRead, c: Conviction, gates: RiskGate[], sizing: Sizing,
): Verdict {
  // Book-level distress (heat/margin) takes precedence over any single idea.
  const heatBlock = gates.find((g) => (g.id === 'heat' || g.id === 'margin') && !g.passed && g.severity === 'BLOCK');
  if (heatBlock) return 'REDUCE_RISK';
  if (hasBlock(gates) || !regime.tradeable) return 'STAND_ASIDE';

  if (c.grade === 'A' && sizing.riskPctEquity > 0) return 'ENGAGE';
  if (c.grade === 'B' && sizing.riskPctEquity > 0) {
    return cautionCount(gates) > 0 ? 'SCALE_IN' : 'ENGAGE';
  }
  if (c.grade === 'C') return 'WAIT_FOR_TRIGGER';
  return 'STAND_ASIDE';
}

// ── The condition that converts a watch into a trade (or changes my mind) ──
function entryTrigger(ctx: MarketContext, thesis: Thesis, verdict: Verdict): string {
  if (verdict === 'STAND_ASIDE') return 'No action. Re-evaluate when the regime or vol backdrop shifts.';
  if (verdict === 'REDUCE_RISK') return 'Trim existing exposure until heat/margin return inside budget before considering anything new.';
  if (verdict === 'ENGAGE') return `Act now on the stated structure; manage against the invalidation level. Abort if VIX jumps > +1.5 intraday.`;
  // WAIT / SCALE_IN need a concrete confirmation.
  if (thesis.stance === 'LONG') {
    const r = ctx.resistance.filter((x) => x > ctx.spot).sort((a, b) => a - b)[0];
    return r ? `Enter on an accepted break and hold above ${(ctx.spot + (r - ctx.spot) * 0.3).toFixed(0)}, with momentum confirming.`
             : `Enter on a higher-low forming above ${ctx.spot.toFixed(0)} with momentum confirming.`;
  }
  if (thesis.stance === 'SHORT') {
    const s = ctx.support.filter((x) => x < ctx.spot).sort((a, b) => b - a)[0];
    return s ? `Enter on a rejection / lower-high below ${(ctx.spot - (ctx.spot - s) * 0.3).toFixed(0)}.`
             : `Enter on a lower-high forming below ${ctx.spot.toFixed(0)} with momentum confirming.`;
  }
  if (thesis.structure === 'PREMIUM_SELLING')
    return `Leg into defined-risk premium on a quiet open near max-pain ${ctx.maxPain.toFixed(0)}; stand down if vol gaps up.`;
  return `Accumulate cheap convexity on further vol compression; confirm with a tightening range before sizing up.`;
}

// ── Narrative: the agent "thinking out loud" in a trader's voice ──
function narrate(
  ctx: MarketContext, regime: RegimeRead, thesis: Thesis, evidence: EvidenceItem[],
  pm: PreMortem, gates: RiskGate[], c: Conviction, sizing: Sizing, verdict: Verdict,
  stats: ReturnType<typeof statsFor>,
): string[] {
  const out: string[] = [];
  out.push(`Regime read — ${regime.description}`);
  out.push(`Working thesis — ${thesis.statement}`);

  const forE = evidence.filter((e) => e.align > 0.15).sort((a, b) => b.align * b.weight - a.align * a.weight);
  const againstE = evidence.filter((e) => e.align < -0.15).sort((a, b) => a.align * a.weight - b.align * b.weight);
  if (forE.length) out.push(`Confluence (${forE.length}) — ${forE.slice(0, 3).map((e) => e.detail).join(' ')}`);
  out.push(againstE.length
    ? `Against (${againstE.length}) — ${againstE.slice(0, 3).map((e) => e.detail).join(' ')}`
    : 'Against — no material contradicting evidence, but I size for the unknown.');

  out.push(`Pre-mortem — most likely failure: ${pm.failureModes[0].scenario} Invalidation: ${pm.invalidation}`);

  const failed = gates.filter((g) => !g.passed);
  out.push(failed.length
    ? `Gates — ${failed.map((g) => `${g.severity === 'BLOCK' ? '⛔' : '⚠'} ${g.detail}`).join(' ')}`
    : 'Gates — all capital-preservation checks clear.');

  if (stats.n > 0)
    out.push(`Memory — this setup (${stats.setupKey.replace(/\|/g, ' · ')}) is ${stats.wins}-${stats.losses} over ${stats.n} resolved trades (hit-rate ${(stats.hitRate * 100).toFixed(0)}%, avg ${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(1)}R), nudging conviction ${c.memoryAdj >= 0 ? '+' : ''}${c.memoryAdj}.`);
  else
    out.push('Memory — no resolved history for this setup yet; conviction rests on present evidence alone.');

  out.push(`Conviction ${c.final.toFixed(0)}/100 (grade ${c.grade}) — confluence ${(c.confluence * 100).toFixed(0)}% vs dissonance ${(c.dissonance * 100).toFixed(0)}%.`);
  out.push(`Verdict — ${verdict.replace(/_/g, ' ')}. ${sizing.rationale}`);
  return out;
}

function headline(verdict: Verdict, thesis: Thesis, c: Conviction): string {
  const v = verdict.replace(/_/g, ' ');
  switch (verdict) {
    case 'ENGAGE': return `${v} · ${thesis.structure.replace('_', ' ')} ${thesis.stance !== 'NEUTRAL' ? thesis.stance : ''} · grade ${c.grade}`.trim();
    case 'SCALE_IN': return `${v} · partial size · ${thesis.structure.replace('_', ' ')} · grade ${c.grade}`;
    case 'WAIT_FOR_TRIGGER': return `${v} · thesis valid, awaiting confirmation · grade ${c.grade}`;
    case 'REDUCE_RISK': return `${v} · book at capacity — defend capital`;
    default: return `${v} · no edge worth risking capital · grade ${c.grade}`;
  }
}

function noteId(ctx: MarketContext): string {
  const t = (ctx.ts || new Date().toISOString()).replace(/[^0-9]/g, '').slice(0, 14);
  return `${ctx.symbol}-${t}-${Math.round((ctx.spot || 0))}`;
}
