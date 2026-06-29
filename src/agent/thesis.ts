import type { MarketContext, RegimeRead, Thesis } from './types';

// ════════════════════════════════════════════════════════════════════════
//  STEP 2 — FORM A THESIS
//  A thesis is a FALSIFIABLE hypothesis, not a signal. It commits to a stance
//  and a structure and states the prior read that motivates it. The agent
//  then spends the rest of the pipeline trying to break it.
// ════════════════════════════════════════════════════════════════════════

export function formThesis(ctx: MarketContext, regime: RegimeRead): Thesis {
  switch (regime.character) {
    case 'TREND': {
      const long = ctx.direction === 'UP';
      return {
        stance: long ? 'LONG' : 'SHORT',
        structure: 'DIRECTIONAL',
        statement: long
          ? 'Trend continuation higher — participate with the established up-trend, defined risk below structure.'
          : 'Trend continuation lower — participate with the established down-trend, defined risk above structure.',
        basis: [
          `Regime engine: ${regime.character} (${(ctx.trendConfidence * 100).toFixed(0)}% confidence)`,
          `Directional tape: ${ctx.direction}, ATR ${(ctx.trendAtr * 100).toFixed(2)}% of spot`,
        ],
      };
    }

    case 'VOLATILE_EXPANSION': {
      // In expansion the edge is in OWNING gamma, not predicting direction.
      return {
        stance: 'NEUTRAL',
        structure: 'LONG_VOL',
        statement: 'Volatility is repricing higher — own gamma / carry defined-risk protection rather than guess direction into the expansion.',
        basis: [
          `VIX ${ctx.vix.toFixed(1)} (${ctx.vixChg >= 0 ? '+' : ''}${ctx.vixChg.toFixed(2)}), IV-rank ${ctx.ivRank.toFixed(0)}`,
          'Realised moves outrunning implied — long convexity is favoured over short premium.',
        ],
      };
    }

    case 'COMPRESSION': {
      return {
        stance: 'NEUTRAL',
        structure: 'LONG_VOL',
        statement: 'Vol is compressed and coiled — accumulate cheap convexity ahead of an expansion rather than fade an absent move.',
        basis: [
          `IV-rank ${ctx.ivRank.toFixed(0)}, VIX ${ctx.vix.toFixed(1)} — premium is structurally cheap`,
          'Breakouts from compression are violent; the asymmetry favours the option buyer.',
        ],
      };
    }

    case 'RANGE': {
      const rich = ctx.ivRank >= 45 || (ctx.vrp ?? 0) > 1;
      return {
        stance: 'NEUTRAL',
        structure: rich ? 'PREMIUM_SELLING' : 'RANGE',
        statement: rich
          ? 'Mean-reverting range with rich premium — sell defined-risk premium around the value area and let theta + a positive VRP work.'
          : 'Mean-reverting range with fair premium — fade extremes toward the value area with tight, defined risk.',
        basis: [
          `Range regime, PCR ${ctx.pcr.toFixed(2)}, max-pain ${ctx.maxPain.toFixed(0)} vs spot ${ctx.spot.toFixed(0)}`,
          rich ? `Vol-risk premium positive (IV-rank ${ctx.ivRank.toFixed(0)})` : 'Premium only fair — selectivity over size',
        ],
      };
    }

    case 'EVENT_DRIVEN':
      return {
        stance: 'NEUTRAL',
        structure: 'LONG_VOL',
        statement: 'Catalyst-driven, bimodal tape — no directional thesis is analysable; the only defensible posture is defined-risk convexity or none.',
        basis: ['Event-risk regime — price is not a clean signal until the catalyst resolves.'],
      };

    case 'UNTRADEABLE':
    default:
      return {
        stance: 'NEUTRAL',
        structure: 'RANGE',
        statement: 'No exploitable structure — the highest-quality decision is to preserve capital and wait.',
        basis: ['Regime read returned UNTRADEABLE.'],
      };
  }
}
