// Smoke test: Decision Engine → Strategy Ranking. Run: npx tsx scripts/ranking.smoke.ts
import { runDecision } from '../src/lib/decision/engine';
import { rankStrategies } from '../src/lib/ranking/engine';
import { computeVolState } from '../src/lib/vol/engine';
import type { DecisionInputs } from '../src/lib/decision/types';
import type { VolInputs } from '../src/lib/vol/types';

const vol = (p: Partial<VolInputs>) => computeVolState({
  atmIv: 14, vix: 14, vixChg: 0, ivRank: 50, ivPctile: 50, hv: 12, vrp: 0,
  emExpiry: 200, emPct: 0.85, termSlope: 1, skew: -1, pInside1: 0.68, ...p,
});

const base: DecisionInputs = {
  macro: { score: 0, confidence: 60 },
  trend: { state: 'NORMAL', direction: 'flat', confidence: 50, trendAtr: 0.5, vixChg: 0 },
  vol: vol({}),
  breadth: { ad: 1.0, pcr: 1.0 },
  flow: { fii: 0, dii: 1000 },
  positioning: { pcr: 1.0, maxPain: 24000, spot: 24000, support: [], resistance: [], gammaFlip: null },
  risk: { heat: 0.013, marginUtil: 0.2, pRuin: 0.0, varPctEquity: 0.01 },
};

function show(name: string, i: DecisionInputs) {
  const d = runDecision(i);
  const r = rankStrategies(d, i.vol, 5);
  console.log(`\n=== ${name} → decision ${d.direction}/${d.volRegime}/sell${d.sellingSuitability} ===`);
  for (const s of r) console.log(`  ${s.score.toString().padStart(3)}  ${s.name.padEnd(22)} ${s.recommended ? '★REC ' : '     '}${s.reasons[0] ?? ''}`);
}

show('Neutral / high-IV', { ...base, vol: vol({ ivRank: 78, vrp: 6, vix: 17 }) });
show('Bull + rich IV', {
  ...base, macro: { score: 45, confidence: 72 },
  trend: { state: 'TRENDING_UP', direction: 'up', confidence: 80, trendAtr: 1.4, vixChg: -3 },
  vol: vol({ ivRank: 72, vrp: 5, vix: 16 }), breadth: { ad: 1.5, pcr: 1.2 }, flow: { fii: 2500, dii: 1500 },
});
show('Bearish + cheap IV', {
  ...base, macro: { score: -40, confidence: 68 },
  trend: { state: 'TRENDING_DOWN', direction: 'down', confidence: 75, trendAtr: 1.2, vixChg: 4 },
  vol: vol({ ivRank: 22, vrp: -2, vix: 10 }), breadth: { ad: 0.6, pcr: 0.8 }, flow: { fii: -3000, dii: -500 },
});
