import type { DecisionOutput } from '../decision/types';
import type { VolState } from '../vol/types';
import type { StrategyArchetype, RankedStrategy, Bias } from './types';
import { clamp } from './types';
import { STRATEGY_CATALOG } from './catalog';

// Score one archetype against the composed decision context. Pure & testable.
function score(a: StrategyArchetype, d: DecisionOutput, v: VolState): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Directional fit.
  const dir: Bias = d.direction === 'BULLISH' ? 'BULL' : d.direction === 'BEARISH' ? 'BEAR' : 'NEUTRAL';
  let dirScore: number;
  if (a.bias === dir) { dirScore = 1; reasons.push(`Matches ${d.direction.toLowerCase()} bias`); }
  else if (a.bias === 'NEUTRAL' || dir === 'NEUTRAL') dirScore = 0.5;
  else { dirScore = 0; }

  // Volatility-regime fit.
  const volScore = a.volFit.includes(v.regime) ? 1 : 0.35;
  if (volScore === 1) reasons.push(`Built for ${v.regime.replace('_', ' ').toLowerCase()} vol`);

  // Vega alignment vs the engine's vega bias.
  const vegaWant = v.vegaBias === 'SHORT_VEGA' ? 'SHORT' : v.vegaBias === 'LONG_VEGA' ? 'LONG' : 'NEUTRAL';
  const vegaScore = a.vega === vegaWant ? 1 : a.vega === 'NEUTRAL' || vegaWant === 'NEUTRAL' ? 0.6 : 0.2;
  if (a.vega === vegaWant && vegaWant !== 'NEUTRAL') reasons.push(`${a.vega.toLowerCase()}-vega aligns with the vol read`);

  // Premium-selling suitability alignment.
  const suit = d.sellingSuitability / 100;
  const suitScore = a.vega === 'SHORT' ? suit : a.vega === 'LONG' ? 1 - suit : 0.5;
  if (a.vega === 'SHORT' && suit > 0.6) reasons.push(`High selling suitability (${d.sellingSuitability.toFixed(0)}/100)`);
  if (a.vega === 'LONG' && suit < 0.45) reasons.push(`Low selling suitability favours long premium`);

  // Extreme-vol guard — penalise undefined-risk short premium.
  let guard = 0;
  if (v.regime === 'EXTREME' && a.vega === 'SHORT' && !a.definedRisk) { guard = -0.25; reasons.push('Penalised: naked short premium in extreme vol'); }
  if (v.regime === 'EXTREME' && a.family === 'Hedge') { guard = 0.15; }

  const composite = clamp(0.34 * dirScore + 0.26 * volScore + 0.22 * vegaScore + 0.18 * suitScore + guard, 0, 1);
  // Confidence tilt: high-conviction decisions sharpen the ranking.
  const conf = 0.85 + 0.15 * (d.confidence / 100);
  return { score: Math.round(composite * conf * 100), reasons: reasons.slice(0, 3) };
}

// Rank the catalog against the decision context.
export function rankStrategies(d: DecisionOutput, v: VolState, top = 8): RankedStrategy[] {
  const recName = d.strategy.name.toLowerCase();
  return STRATEGY_CATALOG
    .map((a) => {
      const { score: s, reasons } = score(a, d, v);
      return {
        key: a.key, name: a.name, family: a.family, bias: a.bias, vega: a.vega, risk: a.risk,
        score: s, reasons,
        recommended: a.name.toLowerCase() === recName || recName.includes(a.name.toLowerCase()),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}
