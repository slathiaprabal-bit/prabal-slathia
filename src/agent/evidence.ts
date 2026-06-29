import type { MarketContext, Thesis, EvidenceItem } from './types';
import { clamp } from './types';

// ════════════════════════════════════════════════════════════════════════
//  STEP 3 — GATHER CONFLUENCE
//  A thesis is only worth risking capital on when several INDEPENDENT factors
//  agree. Each collector returns its alignment with the working thesis on a
//  -1..+1 scale (+ corroborates, - contradicts) plus an importance weight.
//  No single factor can carry a trade; conviction is the weighted consensus.
//  Each collector is a pure function — trivially unit-testable and swappable.
// ════════════════════════════════════════════════════════════════════════

type Collector = (ctx: MarketContext, t: Thesis) => EvidenceItem;

// Sign of the thesis: +1 long, -1 short, 0 neutral.
const dirSign = (t: Thesis) => (t.stance === 'LONG' ? 1 : t.stance === 'SHORT' ? -1 : 0);

// ── 1. Trend alignment ── does the tape agree with a directional thesis? ──
const trendAlignment: Collector = (ctx, t) => {
  const sign = dirSign(t);
  const tapeSign = ctx.direction === 'UP' ? 1 : ctx.direction === 'DOWN' ? -1 : 0;
  // For non-directional theses, a STRONG trend is mild evidence against fading.
  if (sign === 0) {
    const align = -clamp(ctx.trendConfidence - 0.55, -0.4, 0.4); // strong trend → caution on neutral
    return mk('trend', 'Trend vs neutral posture', align, 0.7,
      ctx.trendConfidence >= 0.6
        ? `Tape is trending (${(ctx.trendConfidence * 100).toFixed(0)}%) — neutral structures must respect breakout risk.`
        : 'Tape lacks a dominant trend — supportive of a neutral / mean-reverting posture.');
  }
  const align = clamp(sign * tapeSign * (0.4 + ctx.trendConfidence), -1, 1);
  return mk('trend', 'Trend alignment', align, 1.0,
    align > 0
      ? `Trend confirms the ${t.stance} thesis (${(ctx.trendConfidence * 100).toFixed(0)}% confidence).`
      : `Trend is against the ${t.stance} thesis — counter-trend entries are low quality.`);
};

// ── 2. Volatility / premium edge ── is the structure being paid correctly? ──
const volEdge: Collector = (ctx, t) => {
  const rank = ctx.ivRank;            // 0..100
  const vrp = ctx.vrp ?? 0;           // IV-HV, vol pts
  if (t.structure === 'PREMIUM_SELLING') {
    // Selling wants HIGH rank and POSITIVE vrp (implied richer than realised).
    const align = clamp((rank - 50) / 50 * 0.7 + clamp(vrp / 3, -0.5, 0.5) * 0.6, -1, 1);
    return mk('vol', 'Premium richness (sell edge)', align, 1.0,
      align > 0
        ? `Selling premium into IV-rank ${rank.toFixed(0)}${vrp ? `, VRP +${vrp.toFixed(1)}` : ''} — paid to take the other side.`
        : `IV-rank ${rank.toFixed(0)} is too low to be paid for short premium risk.`);
  }
  if (t.structure === 'LONG_VOL') {
    // Buying wants LOW rank / cheap convexity (or expansion underway).
    const cheap = clamp((40 - rank) / 40, -1, 1);
    const expanding = clamp(ctx.vixChg / 2, -0.5, 0.7);
    const align = clamp(cheap * 0.7 + expanding * 0.5, -1, 1);
    return mk('vol', 'Convexity cost (buy edge)', align, 1.0,
      align > 0
        ? `Long vol with IV-rank ${rank.toFixed(0)} — convexity is cheap relative to the move on offer.`
        : `IV-rank ${rank.toFixed(0)} is rich — paying up for convexity erodes the asymmetry.`);
  }
  // Directional / range: extreme vol is a headwind to clean follow-through.
  const align = clamp((45 - rank) / 60, -0.6, 0.6);
  return mk('vol', 'Volatility backdrop', align, 0.55,
    rank >= 60 ? `Elevated IV-rank ${rank.toFixed(0)} — wider stops, lower hit-rate on directional bets.`
              : `Contained IV-rank ${rank.toFixed(0)} — supportive backdrop for the thesis.`);
};

// ── 3. Dealer gamma ── the structural pin-vs-momentum tell ──
const dealerGamma: Collector = (ctx, t) => {
  // Positive GEX / spot above flip → dealers dampen moves (mean-reverting).
  // Negative GEX / spot below flip → dealers amplify moves (momentum/volatile).
  const aboveFlip = ctx.gammaFlip ? ctx.spot >= ctx.gammaFlip : ctx.gex >= 0;
  const meanReverting = aboveFlip && ctx.gex >= 0;
  const neutral = t.stance === 'NEUTRAL';
  // Mean-reverting backdrop helps premium-selling/range; hurts directional.
  let align: number;
  if (neutral && t.structure !== 'LONG_VOL') align = meanReverting ? 0.6 : -0.5;
  else if (t.structure === 'LONG_VOL') align = meanReverting ? -0.4 : 0.6;
  else align = meanReverting ? -0.35 : 0.45; // directional likes negative gamma
  return mk('gamma', 'Dealer gamma regime', align, 0.8,
    meanReverting
      ? `Positive dealer gamma${ctx.gammaFlip ? ` (spot ${ctx.spot.toFixed(0)} > flip ${ctx.gammaFlip.toFixed(0)})` : ''} — moves get sold into, market pins.`
      : `Negative dealer gamma${ctx.gammaFlip ? ` (spot ${ctx.spot.toFixed(0)} < flip ${ctx.gammaFlip.toFixed(0)})` : ''} — moves get amplified, trends extend.`);
};

// ── 4. Room to target ── is there space for the move before a wall? ──
const roomToTarget: Collector = (ctx, t) => {
  const sign = dirSign(t);
  if (sign === 0) {
    // Neutral structures want the value area (max-pain) NEAR spot.
    const dist = ctx.maxPain ? Math.abs(ctx.spot - ctx.maxPain) / ctx.spot : 0;
    const align = clamp((0.012 - dist) / 0.012, -1, 1);
    return mk('room', 'Spot vs value area', align, 0.7,
      dist <= 0.006 ? `Spot is pinned near max-pain ${ctx.maxPain.toFixed(0)} — supportive of premium / range structures.`
                    : `Spot is ${(dist * 100).toFixed(1)}% from max-pain ${ctx.maxPain.toFixed(0)} — value area offers less of a magnet.`);
  }
  const levels = sign > 0 ? ctx.resistance : ctx.support;
  const next = nearestAhead(ctx.spot, levels, sign);
  if (next === null) {
    return mk('room', 'Room to target', 0.25, 0.6, 'No nearby structural barrier in the thesis direction — clean runway.');
  }
  const room = Math.abs(next - ctx.spot) / ctx.spot;
  const em = Math.max(ctx.expectedMove1d, 0.0005);
  const ratio = room / em;                         // barrier distance in expected-moves
  const align = clamp((ratio - 1) / 2, -1, 1);     // <1 EM away → cramped, >3 → roomy
  return mk('room', 'Room to target', align, 0.85,
    align > 0 ? `${(room * 100).toFixed(1)}% (${ratio.toFixed(1)}× EM) to the next ${sign > 0 ? 'resistance' : 'support'} — room to work.`
              : `Only ${(room * 100).toFixed(1)}% (${ratio.toFixed(1)}× EM) to the next ${sign > 0 ? 'resistance' : 'support'} — cramped reward.`);
};

// ── 5. Positioning extreme ── PCR as a contrarian / confirmation tell ──
const positioning: Collector = (ctx, t) => {
  const sign = dirSign(t);
  // PCR > 1.3 = put-heavy (fear, contrarian bullish); < 0.7 = call-heavy (greed).
  const skew = clamp((ctx.pcr - 1.0) / 0.6, -1, 1); // + = put-heavy
  if (sign === 0) {
    const align = clamp(0.5 - Math.abs(skew), -0.6, 0.6); // balanced book → range-friendly
    return mk('pos', 'Option positioning', align, 0.6,
      Math.abs(skew) < 0.4 ? `Balanced PCR ${ctx.pcr.toFixed(2)} — no positioning extreme to fight a range.`
                           : `Skewed PCR ${ctx.pcr.toFixed(2)} — crowd is leaning, neutral structures carry squeeze risk.`);
  }
  // A put-heavy book (skew>0) is contrarian-bullish → supports LONG.
  const align = clamp(sign * skew * 0.7, -1, 1);
  return mk('pos', 'Positioning (contrarian)', align, 0.65,
    align > 0 ? `PCR ${ctx.pcr.toFixed(2)} leans against the crowd in the thesis's favour.`
              : `PCR ${ctx.pcr.toFixed(2)} shows the crowd already positioned with the thesis — less fuel.`);
};

// ── 6. Probability containment ── does the move fit inside the cone? ──
const containment: Collector = (ctx, t) => {
  if (t.stance === 'NEUTRAL' && t.structure !== 'LONG_VOL') {
    // Range / premium selling wants HIGH P(inside 1σ).
    const align = clamp((ctx.pInside1 - 0.62) / 0.2, -1, 1);
    return mk('cone', 'Containment probability', align, 0.75,
      `P(inside 1σ) ${(ctx.pInside1 * 100).toFixed(0)}% — ${align > 0 ? 'cone supports defined-risk premium' : 'too much tail for comfortable short premium'}.`);
  }
  if (t.structure === 'LONG_VOL') {
    const align = clamp((0.6 - ctx.pInside1) / 0.2, -1, 1); // long vol wants a FAT tail
    return mk('cone', 'Tail energy', align, 0.6,
      `P(inside 1σ) ${(ctx.pInside1 * 100).toFixed(0)}% — ${align > 0 ? 'fat tail favours owning convexity' : 'distribution is tight, convexity may decay'}.`);
  }
  // Directional: a wide expected move means the trend has fuel.
  const align = clamp((ctx.expectedMove1d - 0.006) / 0.008, -0.5, 0.6);
  return mk('cone', 'Expected-move energy', align, 0.5,
    `Expected 1-day move ${(ctx.expectedMove1d * 100).toFixed(2)}% — ${align > 0 ? 'enough energy for follow-through' : 'muted, follow-through uncertain'}.`);
};

export const COLLECTORS: Collector[] = [
  trendAlignment, volEdge, dealerGamma, roomToTarget, positioning, containment,
];

export function gatherEvidence(ctx: MarketContext, thesis: Thesis): EvidenceItem[] {
  return COLLECTORS.map((c) => c(ctx, thesis));
}

// ── helpers ───────────────────────────────────────────────────────────────
function mk(id: string, label: string, align: number, weight: number, detail: string): EvidenceItem {
  return { id, label, align: clamp(align, -1, 1), weight, detail };
}

function nearestAhead(spot: number, levels: number[], sign: number): number | null {
  const ahead = (levels ?? []).filter((l) => (sign > 0 ? l > spot : l < spot));
  if (!ahead.length) return null;
  return sign > 0 ? Math.min(...ahead) : Math.max(...ahead);
}
