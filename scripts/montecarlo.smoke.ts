// Smoke test for the Monte Carlo Probability engine. Run: npx tsx scripts/montecarlo.smoke.ts
import { runMonteCarlo } from '../src/lib/montecarlo/engine';
import type { MCInputs } from '../src/lib/montecarlo/types';

function show(name: string, i: MCInputs) {
  const m = runMonteCarlo(i);
  console.log(`\n=== ${name} ===`);
  console.log(`  P(profit) ${m.pProfit}%   P(maxProfit) ${m.pMaxProfit}%   E[P&L] ₹${m.expectedPnl}`);
  console.log(`  touch put ${m.pTouchPut}%  touch call ${m.pTouchCall}%`);
  console.log(`  break-evens ${m.breakevens[0]} / ${m.breakevens[1]}   terminal P05/50/95 ${m.terminalP05}/${m.terminalP50}/${m.terminalP95}`);
  console.log(`  P&L P05/50/95 ₹${m.pnlP05}/${m.pnlP50}/${m.pnlP95}`);
}

const base = { spot: 24000, vix: 14, dte: 7, lotSize: 75, creditPerLot: 9000, maxLoss: 13000, paths: 4000 };
// Iron condor: short put 23500, short call 24500.
show('Iron Condor 23500/24500', { ...base, shortPut: 23500, shortCall: 24500 });
// Bull put spread: only short put.
show('Bull Put 23600', { ...base, shortPut: 23600, shortCall: null });
// Wide condor (should have higher P(profit)).
show('Wide Condor 23000/25000', { ...base, shortPut: 23000, shortCall: 25000 });
// High vol — lower P(profit).
show('Iron Condor in high vol (vix 26)', { ...base, vix: 26, shortPut: 23500, shortCall: 24500 });
