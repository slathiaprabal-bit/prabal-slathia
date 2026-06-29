import type { MarketContext, Thesis, EvidenceItem, PreMortem, FailureMode } from './types';
import { clamp } from './types';

// ════════════════════════════════════════════════════════════════════════
//  STEP 4 — PRE-MORTEM (disconfirmation / red-team)
//  The single biggest driver of bad trades is confirmation bias. Before sizing
//  anything, the agent assumes the trade has ALREADY LOST and enumerates why.
//  Failure modes are mined from the contradicting evidence and from known
//  fragilities of the regime, then a concrete INVALIDATION level is stated —
//  the event that proves the thesis wrong and forces an exit.
// ════════════════════════════════════════════════════════════════════════

export function runPreMortem(ctx: MarketContext, thesis: Thesis, evidence: EvidenceItem[]): PreMortem {
  const modes: FailureMode[] = [];

  // Mine the strongest CONTRADICTING evidence into explicit failure scenarios.
  for (const e of evidence) {
    if (e.align < -0.15) {
      modes.push({
        scenario: `${e.label}: ${e.detail}`,
        likelihood: clamp(Math.abs(e.align) * e.weight + 0.15, 0, 1),
        severity: clamp(e.weight, 0.3, 1),
      });
    }
  }

  // Regime-structural fragilities the evidence may not capture.
  if (ctx.vixChg >= 1.2) {
    modes.push({
      scenario: `Volatility is rising (+${ctx.vixChg.toFixed(1)} pts) — a vol spike re-prices every short-premium and directional position against you at once.`,
      likelihood: clamp(ctx.vixChg / 4, 0.2, 0.85),
      severity: thesis.structure === 'PREMIUM_SELLING' ? 0.95 : 0.6,
    });
  }
  if (ctx.chainSynthetic) {
    modes.push({
      scenario: 'Option-chain positioning is SYNTHETIC, not live — max-pain, PCR and gamma levels may be wrong, so any positioning-based edge is unverified.',
      likelihood: 0.5,
      severity: 0.5,
    });
  }
  if (thesis.structure === 'PREMIUM_SELLING' && ctx.pInside1 < 0.6) {
    modes.push({
      scenario: `Containment is only ${(ctx.pInside1 * 100).toFixed(0)}% — the realised distribution has enough tail to breach short strikes more often than the credit compensates.`,
      likelihood: clamp(0.7 - ctx.pInside1, 0.15, 0.6),
      severity: 0.85,
    });
  }
  if (thesis.stance !== 'NEUTRAL' && ctx.trendConfidence < 0.45) {
    modes.push({
      scenario: 'Directional thesis without a confirmed trend — chop whipsaws entries and stops, bleeding the account on a thesis that needs follow-through.',
      likelihood: 0.5,
      severity: 0.6,
    });
  }

  if (!modes.length) {
    modes.push({
      scenario: 'No dominant failure mode surfaced — but absence of evidence is not evidence of absence; size for the unknown unknown.',
      likelihood: 0.2,
      severity: 0.4,
    });
  }

  modes.sort((a, b) => b.likelihood * b.severity - a.likelihood * a.severity);

  return {
    failureModes: modes.slice(0, 5),
    invalidation: invalidationLevel(ctx, thesis),
    worstCase: worstCase(ctx, thesis),
  };
}

// The concrete trigger that proves the thesis wrong — stated as a price/vol level.
function invalidationLevel(ctx: MarketContext, thesis: Thesis): string {
  if (thesis.stance === 'LONG') {
    const sup = ctx.support.filter((s) => s < ctx.spot).sort((a, b) => b - a)[0];
    return sup
      ? `Sustained trade below ${sup.toFixed(0)} (nearest support) invalidates the long.`
      : `A close below ${(ctx.spot * (1 - Math.max(ctx.expectedMove1d, 0.006))).toFixed(0)} (~1 EM down) invalidates the long.`;
  }
  if (thesis.stance === 'SHORT') {
    const res = ctx.resistance.filter((s) => s > ctx.spot).sort((a, b) => a - b)[0];
    return res
      ? `Sustained trade above ${res.toFixed(0)} (nearest resistance) invalidates the short.`
      : `A close above ${(ctx.spot * (1 + Math.max(ctx.expectedMove1d, 0.006))).toFixed(0)} (~1 EM up) invalidates the short.`;
  }
  if (thesis.structure === 'PREMIUM_SELLING') {
    const up = (ctx.spot * (1 + Math.max(ctx.expectedMove1d, 0.006))).toFixed(0);
    const dn = (ctx.spot * (1 - Math.max(ctx.expectedMove1d, 0.006))).toFixed(0);
    return `A decisive break of the ${dn}–${up} expected-move band, or a VIX jump > +1.5, invalidates the short-premium thesis.`;
  }
  return `A vol collapse back toward IV-rank < 20, or a quiet pin at max-pain ${ctx.maxPain.toFixed(0)}, invalidates the long-vol thesis.`;
}

function worstCase(ctx: MarketContext, thesis: Thesis): string {
  if (thesis.structure === 'PREMIUM_SELLING')
    return 'Gap through short strikes on an overnight catalyst — defined-risk wings are mandatory, never naked.';
  if (thesis.structure === 'LONG_VOL')
    return 'Vol bleeds and the move never comes — theta decay caps the loss at premium paid; size it as a known, affordable cost.';
  return `A fast reversal back through ${ctx.spot.toFixed(0)} against the position — the stop must be mechanical, not discretionary.`;
}
