// Smoke test for the research-validation backtest. Run: npx tsx scripts/researchbt.smoke.ts
import { runResearchBacktest } from '../src/lib/research/backtest';

let s = 11; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const gauss = (m: number, sd: number) => m + sd * Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

// Trending series (momentum should have edge) then noisy series (no edge).
function series(name: string, gen: (i: number) => number, n = 180) {
  const r = Array.from({ length: n }, (_, i) => gen(i));
  const b = runResearchBacktest(r);
  console.log(`\n=== ${name} ===`);
  console.log(`  samples ${b.samples}  accuracy ${(b.accuracy * 100).toFixed(0)}%  F1 ${b.f1}  Brier ${b.brier}`);
  console.log(`  confusion tp${b.confusion.tp} fp${b.confusion.fp} tn${b.confusion.tn} fn${b.confusion.fn}`);
  console.log(`  Sharpe ${b.sharpe}  maxDD ${(b.maxDD * 100).toFixed(1)}%  Calmar ${b.calmar}  totRet ${b.totalReturn}`);
  console.log(`  drift: 1st ${(b.drift.firstHalfAcc * 100).toFixed(0)}% 2nd ${(b.drift.secondHalfAcc * 100).toFixed(0)}% PSI ${b.drift.psi}`);
  console.log(`  calibration bins: ${b.calibration.length}`);
}

// Persistent trend with momentum → should beat 50%.
let drift = 0;
series('Trending (momentum edge)', () => { drift += gauss(0.02, 0.05); return drift * 0.05 + gauss(0.1, 0.7); });
// Pure noise → ~50%, ~zero Sharpe.
series('White noise (no edge)', () => gauss(0, 1));
