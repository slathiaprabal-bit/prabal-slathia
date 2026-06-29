import type { MarketContext, RegimeRead, Thesis, RiskGate } from './types';

// ════════════════════════════════════════════════════════════════════════
//  STEP 5 — RISK GATES (capital-preservation vetoes)
//  These are NON-NEGOTIABLE. A trade can have perfect confluence and still be
//  vetoed because a single gate protects the account from ruin. A failed BLOCK
//  gate forces STAND_ASIDE; a failed CAUTION gate caps size and downgrades the
//  setup. This is the layer that "preserves capital" and "reduces bad trades"
//  by making the agent willing to do nothing.
// ════════════════════════════════════════════════════════════════════════

type GateFn = (ctx: MarketContext, regime: RegimeRead, thesis: Thesis) => RiskGate;

const eventRisk: GateFn = (ctx, regime) => pass(
  'event_risk', 'Event-risk clearance',
  regime.character !== 'EVENT_DRIVEN' && ctx.vixChg < 2.5,
  'BLOCK',
  regime.character === 'EVENT_DRIVEN'
    ? 'Catalyst-driven regime — new directional/short-premium risk is vetoed until it clears.'
    : 'No binary catalyst dominating the tape.',
);

const noGo: GateFn = (_ctx, regime) => pass(
  'no_go', 'Regime tradeability',
  regime.tradeable,
  'BLOCK',
  regime.tradeable ? 'Regime is structured enough to trade.' : 'Regime is UNTRADEABLE — preserve capital.',
);

const heat: GateFn = (ctx) => pass(
  'heat', 'Portfolio heat budget',
  ctx.portfolioHeat < 0.8,
  ctx.portfolioHeat >= 0.8 ? 'BLOCK' : 'CAUTION',
  ctx.portfolioHeat >= 0.8
    ? `Heat at ${(ctx.portfolioHeat * 100).toFixed(0)}% of budget — no capacity to add risk; manage existing book.`
    : ctx.portfolioHeat >= 0.55
      ? `Heat at ${(ctx.portfolioHeat * 100).toFixed(0)}% — limited capacity, size conservatively.`
      : `Heat at ${(ctx.portfolioHeat * 100).toFixed(0)}% — ample risk capacity.`,
);

const margin: GateFn = (ctx) => pass(
  'margin', 'Margin utilisation',
  ctx.marginUsage < 0.85,
  'BLOCK',
  ctx.marginUsage >= 0.85
    ? `Margin at ${(ctx.marginUsage * 100).toFixed(0)}% — a vol spike triggers a forced-liquidation cascade; no new positions.`
    : `Margin at ${(ctx.marginUsage * 100).toFixed(0)}% — within safe operating range.`,
);

const dataQuality: GateFn = (ctx, _r, thesis) => {
  // Positioning-dependent structures can't trust synthetic chain data.
  const needsChain = thesis.structure === 'PREMIUM_SELLING' || thesis.structure === 'RANGE';
  const ok = !(ctx.chainSynthetic && needsChain) && (ctx.dataLive || !needsChain);
  return pass(
    'data', 'Data integrity',
    ok,
    'CAUTION',
    ok
      ? 'Feed and chain data are reliable for this structure.'
      : 'Positioning-based structure on SYNTHETIC/stale chain data — the edge is unverified; halve conviction.',
  );
};

const nakedPremiumIntoVol: GateFn = (ctx, _r, thesis) => {
  const selling = thesis.structure === 'PREMIUM_SELLING';
  const ok = !(selling && (ctx.vixChg >= 1.5 || ctx.ivRank < 30));
  return pass(
    'premium_vol', 'Short-premium conditions',
    ok,
    ctx.vixChg >= 1.5 ? 'BLOCK' : 'CAUTION',
    !selling ? 'Not a short-premium structure.'
      : ctx.vixChg >= 1.5 ? `Selling premium while vol is spiking (+${ctx.vixChg.toFixed(1)}) — vetoed; you are short gamma into expansion.`
      : ctx.ivRank < 30 ? `IV-rank ${ctx.ivRank.toFixed(0)} is too thin to be paid for short-premium tail risk.`
      : 'Conditions support collecting premium.',
  );
};

const againstRegime: GateFn = (_ctx, regime, thesis) => {
  const ok = regime.favored.length === 0 || regime.favored.includes(thesis.structure);
  return pass(
    'regime_fit', 'Structure vs regime',
    ok,
    'CAUTION',
    ok ? `${thesis.structure} is favoured by the ${regime.character} regime.`
       : `${thesis.structure} fights the ${regime.character} regime (prefers ${regime.favored.join(' / ')}) — trade smaller or wait.`,
  );
};

export const GATES: GateFn[] = [
  eventRisk, noGo, heat, margin, dataQuality, nakedPremiumIntoVol, againstRegime,
];

export function runGates(ctx: MarketContext, regime: RegimeRead, thesis: Thesis): RiskGate[] {
  return GATES.map((g) => g(ctx, regime, thesis));
}

export const hasBlock = (gates: RiskGate[]) => gates.some((g) => !g.passed && g.severity === 'BLOCK');
export const cautionCount = (gates: RiskGate[]) => gates.filter((g) => !g.passed && g.severity === 'CAUTION').length;

function pass(id: string, label: string, ok: boolean, severity: RiskGate['severity'], detail: string): RiskGate {
  return { id, label, passed: ok, severity, detail };
}
