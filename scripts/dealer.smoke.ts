// Smoke test: Greeks Engine → Dealer Positioning. Run: npx tsx scripts/dealer.smoke.ts
import { computeGreeksChain } from '../src/lib/greeks/engine';
import { computeDealerPositioning } from '../src/lib/dealer/engine';
import type { ChainRowInput } from '../src/lib/greeks/types';

const spot = 24000;
const rows: ChainRowInput[] = [];
for (let k = spot - 1000; k <= spot + 1000; k += 100) {
  // Synthetic OI: puts heavier below spot, calls heavier above (typical skew).
  rows.push({
    strike: k,
    ceOI: Math.round(2000 + Math.max(0, (k - spot) / 100) * 600 + 800),
    peOI: Math.round(2000 + Math.max(0, (spot - k) / 100) * 700 + 800),
    ceIV: 15 + Math.abs(k - spot) / 200,
    peIV: 16 + Math.abs(k - spot) / 180,
  });
}

const chain = computeGreeksChain({ spot, dte: 7, rate: 0.066, lotSize: 75, rows });
const d = computeDealerPositioning(chain);

console.log('ATM strike      :', chain.atmStrike);
console.log('rows            :', chain.rows.length);
console.log('net GEX (₹Cr)   :', (d.netGex / 1e7).toFixed(1));
console.log('gamma regime    :', d.gammaRegime);
console.log('gamma flip      :', d.gammaFlip ? Math.round(d.gammaFlip) : null);
console.log('max pain        :', d.maxPain);
console.log('call/put wall   :', d.callWall, '/', d.putWall);
console.log('vanna / charm   :', d.vannaExposure.toFixed(0), '/', d.charmExposure.toFixed(0));
console.log('\nreasoning:');
d.reasoning.forEach((r) => console.log('  • ' + r));
const peak = [...d.profile].sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))[0];
console.log('\npeak GEX strike :', peak.strike, '(', (peak.gex / 1e7).toFixed(1), '₹Cr )');
