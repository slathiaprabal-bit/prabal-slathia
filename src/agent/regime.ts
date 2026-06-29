import type { MarketContext, RegimeRead, Structure } from './types';

// ════════════════════════════════════════════════════════════════════════
//  STEP 1 — READ THE REGIME
//  A discretionary trader's first question is never "buy or sell?" — it is
//  "what kind of market is this, and should I be trading it at all?". This
//  classifies the environment and declares which structures it rewards. Any
//  thesis that fights the regime is penalised later (see gates / conviction).
// ════════════════════════════════════════════════════════════════════════

export function readRegime(ctx: MarketContext): RegimeRead {
  const s = ctx.regimeState.toUpperCase();

  // ── Hard environmental stops ──
  if (s === 'NO_GO') {
    return {
      character: 'UNTRADEABLE',
      tradeable: false,
      description: 'Engine flags a NO-GO regime — disordered tape, no exploitable structure.',
      favored: [],
    };
  }
  if (s === 'EVENT_RISK' || ctx.vixChg >= 2.5) {
    return {
      character: 'EVENT_DRIVEN',
      tradeable: false,
      description: 'Event risk dominates — outcomes are bimodal and not analysable from price. Stand aside until the catalyst clears.',
      favored: ['LONG_VOL'],
    };
  }

  // ── Volatility expansion: vol high and rising, premium dear but dangerous ──
  if ((ctx.vix >= 18 && ctx.vixChg > 0.75) || ctx.ivRank >= 75) {
    return {
      character: 'VOLATILE_EXPANSION',
      tradeable: true,
      description: 'Volatility expanding — directional moves are large and trends fragile. Long-gamma / defined-risk only; selling naked premium into this is how books blow up.',
      favored: ['LONG_VOL', 'DIRECTIONAL'],
    };
  }

  // ── Compression: cheap vol, coiled range — premium is poor but stable ──
  if (ctx.ivRank <= 25 && ctx.vix < 14 && ctx.trendConfidence < 0.45) {
    return {
      character: 'COMPRESSION',
      tradeable: true,
      description: 'Low-vol compression — premium is thin and breakouts can be violent. Favour cheap long-vol or patient range fades; avoid over-selling cheap options.',
      favored: ['LONG_VOL', 'RANGE'],
    };
  }

  // ── Trend: directional engine confident, ATR confirms participation ──
  if ((s === 'TRENDING_UP' || s === 'TRENDING_DOWN') && ctx.trendConfidence >= 0.5 && ctx.trendAtr >= 0.006) {
    return {
      character: 'TREND',
      tradeable: true,
      description: `Established ${s === 'TRENDING_UP' ? 'up' : 'down'}-trend — confidence ${(ctx.trendConfidence * 100).toFixed(0)}%. Trade with the trend; counter-trend fades are low-quality here.`,
      favored: ['DIRECTIONAL'],
    };
  }

  // ── Default: range-bound, mean-reverting ──
  const favored: Structure[] = ctx.ivRank >= 45 ? ['PREMIUM_SELLING', 'RANGE'] : ['RANGE', 'PREMIUM_SELLING'];
  return {
    character: 'RANGE',
    tradeable: true,
    description: ctx.ivRank >= 45
      ? 'Range-bound with a healthy vol-risk premium — the environment rewards selling rich, defined-risk premium and fading extremes.'
      : 'Range-bound but premium is only fair — be selective; capture is incremental, not structural.',
    favored,
  };
}
