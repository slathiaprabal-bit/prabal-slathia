// Recommended option strategies for the detected volatility regime.
// Pure, deterministic scoring over VolState — each strategy earns points where
// the state matches the conditions it monetizes and loses points where the
// state fights it. No LLM, fully testable.
import type { VolState } from './types';
import { clamp } from './types';

export type VolSide = 'SHORT_VOL' | 'LONG_VOL' | 'NEUTRAL';

export interface StrategyRec {
  name: string;
  side: VolSide;
  score: number;     // 0..100 regime fit
  rationale: string; // one desk-note line for THIS regime
}

export function rankVolStrategies(v: VolState): StrategyRec[] {
  const rich = v.premiumRichness === 'RICH' ? 1 : v.premiumRichness === 'CHEAP' ? -1 : 0;
  const ivr = (v.ivRank - 50) / 50;                       // −1..1
  const compEdge = (v.compressionProb - v.expansionProb) / 100; // + favours short vol
  const contango = clamp(v.termSlope / 3, -1, 1);
  const putSkew = clamp(-v.skew / 3, 0, 1);               // 0..1 when puts bid
  const extreme = v.regime === 'EXTREME' ? 1 : 0;
  const high = v.regime === 'HIGH' || extreme ? 1 : 0;
  const calm = v.regime === 'VERY_LOW' || v.regime === 'LOW' ? 1 : 0;
  const rising = v.trend === 'RISING' ? 1 : 0;
  const falling = v.trend === 'FALLING' ? 1 : 0;

  const S = (x: number) => Math.round(clamp(50 + 50 * x, 2, 98));

  const recs: StrategyRec[] = [
    {
      name: 'Short Strangle', side: 'SHORT_VOL',
      score: S(0.5 * rich + 0.35 * compEdge + 0.3 * ivr - 0.5 * extreme - 0.35 * rising),
      rationale: rich > 0
        ? `Collects the ${v.vrp >= 0 ? '+' : ''}${v.vrp.toFixed(1)} VRP with ${v.compressionProb.toFixed(0)}% compression odds — undefined risk, so size for the ${v.regime.toLowerCase().replace('_', ' ')} regime.`
        : 'Premium is not rich enough to be paid for naked gamma risk here.',
    },
    {
      name: 'Iron Condor', side: 'SHORT_VOL',
      score: S(0.45 * rich + 0.3 * compEdge + 0.25 * ivr + 0.25 * high - 0.25 * rising),
      rationale: 'Defined-risk premium capture — the wings cost part of the edge but cap the tail, the right trade-off when vol can still jump.',
    },
    {
      name: 'Jade Lizard', side: 'SHORT_VOL',
      score: S(0.4 * rich + 0.45 * putSkew + 0.2 * compEdge - 0.3 * extreme),
      rationale: putSkew > 0.3
        ? `Put wing is bid (skew ${v.skew.toFixed(1)}) — sells the rich put side and finances the call spread so there is no upside risk.`
        : 'Needs a bid put wing to be paid properly; skew is flat.',
    },
    {
      name: 'Broken Wing Butterfly', side: 'SHORT_VOL',
      score: S(0.35 * rich + 0.3 * compEdge + 0.25 * ivr + 0.15 * high + 0.15 * (v.pInside1 - 0.6)),
      rationale: `Pins the ${(v.pInside1 * 100).toFixed(0)}%-probability 1σ zone with capped risk — premium harvesting for a range-bound read.`,
    },
    {
      name: 'Calendar Spread', side: 'NEUTRAL',
      score: S(0.5 * contango + 0.2 * (1 - Math.abs(ivr)) - 0.3 * extreme - 0.2 * falling),
      rationale: v.termSlope >= 0.4
        ? `Contango +${v.termSlope.toFixed(1)} — rent the decaying front expiry against a cheaper-carry back month.`
        : 'Term curve is not paying calendar carry right now.',
    },
    {
      name: 'Diagonal Spread', side: 'NEUTRAL',
      score: S(0.35 * contango + 0.25 * putSkew + 0.15 * (1 - Math.abs(ivr)) - 0.25 * extreme),
      rationale: 'Calendar carry plus a directional tilt — earns the front-month decay while keeping back-month convexity.',
    },
    {
      name: 'Long Straddle', side: 'LONG_VOL',
      score: S(-0.5 * rich + 0.45 * (v.expansionProb - 50) / 50 + 0.35 * calm - 0.3 * falling),
      rationale: rich < 0
        ? `IV under realized (VRP ${v.vrp.toFixed(1)}) with ${v.expansionProb.toFixed(0)}% expansion odds — owning gamma is cheap ahead of a move.`
        : 'Paying rich premium for gamma needs a catalyst; carry is against you.',
    },
    {
      name: 'Long Strangle', side: 'LONG_VOL',
      score: S(-0.45 * rich + 0.4 * (v.expansionProb - 50) / 50 + 0.3 * calm - 0.3 * falling - 0.1),
      rationale: 'Cheaper convexity than the straddle, needs a larger move — best when expansion odds are strong and wings are not bid.',
    },
    {
      name: 'Put Ratio Backspread', side: 'LONG_VOL',
      score: S(0.35 * (v.expansionProb - 50) / 50 + 0.3 * rising + 0.2 * putSkew * -1 + 0.2 * (extreme + high) * 0.5),
      rationale: 'Crash convexity financed by the near put — pays off on acceleration lower, flat cost if the market holds.',
    },
    {
      name: 'Credit Spreads (verticals)', side: 'SHORT_VOL',
      score: S(0.35 * rich + 0.25 * ivr + 0.2 * compEdge + 0.15 * high),
      rationale: 'The smallest, most liquid premium-selling unit — defined risk, easy to lean with the skew side that is paid.',
    },
  ];

  return recs.sort((a, b) => b.score - a.score).slice(0, 6);
}
