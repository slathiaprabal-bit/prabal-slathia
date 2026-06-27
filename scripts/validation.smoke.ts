// Smoke test for the Validation module. Run: npx tsx scripts/validation.smoke.ts
import { validateGreeks, validateMonteCarlo, validateHmm, validateDealer, buildReport } from '../src/lib/validation/engine';
import { runMonteCarlo } from '../src/lib/montecarlo/engine';
import { computeGreeksChain } from '../src/lib/greeks/engine';
import { computeDealerPositioning } from '../src/lib/dealer/engine';
import { fitHmm } from '../src/lib/hmm/engine';
import type { ChainRowInput } from '../src/lib/greeks/types';

// Greeks
const gRes = validateGreeks(24000, 7, 14);

// Monte Carlo
const mcIn = { spot: 24000, vix: 14, dte: 7, lotSize: 75, shortPut: 23500, shortCall: 24500, creditPerLot: 9000, maxLoss: 13000, paths: 4000 };
const mc = runMonteCarlo(mcIn);
const mcRes = validateMonteCarlo(mcIn, mc);

// HMM (calm series)
let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const series = Array.from({ length: 180 }, () => rnd() * 1.2 - 0.55);
const hRes = validateHmm(fitHmm({ returns: series }));

// Dealer
const rows: ChainRowInput[] = [];
for (let k = 23000; k <= 25000; k += 100) rows.push({ strike: k, ceOI: 2000 + Math.abs(k - 24000) / 10, peOI: 2000 + Math.abs(k - 24000) / 8, ceIV: 15, peIV: 16 });
const dRes = validateDealer(computeDealerPositioning(computeGreeksChain({ spot: 24000, dte: 7, rate: 0.066, lotSize: 75, rows })));

const report = buildReport([...gRes, ...mcRes, ...hRes, ...dRes]);
console.log(`pass rate: ${(report.passRate * 100).toFixed(0)}%  (${report.results.filter(r => r.status === 'PASS').length}/${report.results.length})\n`);
for (const r of report.results) {
  console.log(`  [${r.status.padEnd(4)}] ${r.category.padEnd(11)} ${r.label.padEnd(34)} ${r.note}${r.ci ? `  CI[${r.ci[0].toFixed(1)}, ${r.ci[1].toFixed(1)}]` : ''}`);
}
