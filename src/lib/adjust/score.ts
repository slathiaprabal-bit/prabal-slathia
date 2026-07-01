// Mode-specific weighted objective functions. Each returns a RAW score; the
// optimizer min-max normalizes across candidates to 0..100. Weighted trade-offs,
// not fixed rules — the ranking emerges from the objective.
import type { AdjMode, Metrics, Position, VolContext } from './types';

const frac = (num: number, den: number) => num / (Math.abs(den) + 1e-6);

export function rawScore(mode: AdjMode, m: Metrics, b: Metrics, pos: Position, vol: VolContext): number {
  const absDelta = Math.abs(m.delta) / pos.lotSize;                 // ~option-delta units
  const marginAdd = Math.max(0, m.margin - b.margin) / (b.margin + 1);
  const popImprove = m.pop - b.pop;
  const lossImprove = frac(m.maxLoss - b.maxLoss, b.maxLoss);       // less-negative = better
  const thetaChange = frac(m.theta - b.theta, b.theta);

  switch (mode) {
    case 'DEFENSIVE': {
      const gammaCut = frac(Math.abs(b.gamma) - Math.abs(m.gamma), b.gamma);
      const vegaCut = frac(Math.abs(b.vega) - Math.abs(m.vega), b.vega);
      return 2.2 * popImprove
        + 1.4 * lossImprove
        + 0.8 * gammaCut
        + 0.8 * vegaCut
        - 0.6 * absDelta
        - 0.5 * marginAdd;
    }
    case 'THETA': {
      const thetaPenalty = m.theta <= 0 ? 3 : 0;   // must stay theta-positive
      return 1.8 * thetaChange
        - 1.4 * absDelta
        - 2.2 * marginAdd                          // "minimal additional margin"
        - 0.4 * Math.max(0, b.pop - m.pop)
        - thetaPenalty;
    }
    case 'CRASH': {
      // Convex downside opportunity with controlled risk and preserved theta.
      const convex = frac(m.tailPayoff, Math.abs(b.maxProfit) + Math.abs(b.tailPayoff) + 1);
      const tailGain = frac(m.tailPayoff - b.tailPayoff, b.tailPayoff);
      const thetaGuard = -1.0 * Math.max(0, -m.theta) / (Math.abs(b.theta) + 1);
      const riskGuard = -0.9 * Math.max(0, Math.abs(m.maxLoss) - 1.3 * Math.abs(b.maxLoss)) / (Math.abs(b.maxLoss) + 1);
      // Prefer near-cost-neutral asymmetry (ratio structures) over paying up for
      // expensive long premium.
      const costGuard = -1.3 * Math.max(0, -m.adjustCost) / (pos.spot * pos.lotSize * 0.01);
      const mustBeConvex = m.tailPayoff <= b.tailPayoff ? -2 : 0;   // reject non-convex
      return 2.4 * convex + 0.7 * tailGain + thetaGuard + riskGuard + costGuard + mustBeConvex;
    }
    case 'VOL': {
      if (vol.expansionExpected) {
        const vegaUp = frac(m.vega - b.vega, b.vega);   // want long vega
        return 1.8 * vegaUp - 0.9 * absDelta + 0.3 * popImprove - 0.4 * marginAdd;
      }
      const vegaDown = frac(b.vega - m.vega, b.vega);    // want short vega
      return 1.6 * vegaDown + 1.0 * thetaChange - 0.9 * absDelta - 0.4 * marginAdd;
    }
  }
}
