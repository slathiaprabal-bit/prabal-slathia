// Standalone smoke test for the Decision Engine — proves every domain and the
// aggregator are testable in isolation (no React, no store, no live data).
// Run: npx tsx scripts/decision.smoke.ts
import { runDecision } from '../src/lib/decision/engine';
import type { DecisionInputs } from '../src/lib/decision/types';

function show(name: string, i: DecisionInputs) {
  const d = runDecision(i);
  console.log(`\n=== ${name} ===`);
  console.log(`  ${d.direction} (score ${d.directionalScore})  trend=${d.trendStrength}  vol=${d.volRegime}  sell=${d.sellingSuitability}  conf=${d.confidence}`);
  console.log(`  strategy: ${d.strategy.name} [${d.strategy.family}]`);
  console.log(`  factors: ${d.factors.map((f) => `${f.label} ${f.bias > 0 ? '+' : ''}${(f.bias * 100).toFixed(0)}`).join(', ')}`);
}

const base: DecisionInputs = {
  macro: { score: 0, confidence: 60 },
  trend: { state: 'NORMAL', direction: 'flat', confidence: 50, trendAtr: 0.5, vixChg: 0 },
  vol: { ivRank: 50, ivPctile: 50, vrp: 0, vix: 14, pInside1: 0.68, hv20: 12 },
  breadth: { ad: 1.0, pcr: 1.0 },
  flow: { fii: 0, dii: 1000 },
  positioning: { pcr: 1.0, maxPain: 24000, spot: 24000, support: [], resistance: [], gammaFlip: null },
  risk: { heat: 0.013, margin: 0.2, pRuin: 0.0 },
};

show('Neutral / high-IV → condor', { ...base, vol: { ...base.vol, ivRank: 78, vrp: 6, vix: 17 } });
show('Strong bull + rich IV → jade lizard', {
  ...base, macro: { score: 45, confidence: 72 },
  trend: { state: 'TRENDING_UP', direction: 'up', confidence: 80, trendAtr: 1.4, vixChg: -3 },
  vol: { ...base.vol, ivRank: 72, vrp: 5, vix: 16 },
  breadth: { ad: 1.5, pcr: 1.2 }, flow: { fii: 2500, dii: 1500 },
  positioning: { ...base.positioning, pcr: 1.25, maxPain: 24300, spot: 24000 },
});
show('Bearish + cheap IV → bear put', {
  ...base, macro: { score: -40, confidence: 68 },
  trend: { state: 'TRENDING_DOWN', direction: 'down', confidence: 75, trendAtr: 1.2, vixChg: 4 },
  vol: { ...base.vol, ivRank: 22, vrp: -2, vix: 10 },
  breadth: { ad: 0.6, pcr: 0.8 }, flow: { fii: -3000, dii: -500 },
});
show('Extreme vol / stretched risk → defensive', {
  ...base, vol: { ...base.vol, ivRank: 90, vrp: 9, vix: 26 },
  risk: { heat: 0.045, margin: 0.55, pRuin: 0.04 },
});
