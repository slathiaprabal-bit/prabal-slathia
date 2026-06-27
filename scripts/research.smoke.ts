// Smoke test for the research recorder + feature row. Run: npx tsx scripts/research.smoke.ts
import { buildResearchRow } from '../src/lib/research/features';
import { researchRecorder } from '../src/lib/research/recorder';

const snap: any = {
  ts: '2026-06-27T10:00:00Z', source: 'cache', chainSynthetic: true, spot: 27747,
  vol: { vix: 16.5, ivRank: 55, ivPctile: 95, hv20: 10, vrp: 6.5, emExpiry: 635, pInside1: 0.68 },
  positioning: { pcr: 1, maxPain: 27750 }, regime: { state: 'TRENDING_UP', confidence: 77 },
  trade: { shortPut: 27000, shortCall: null, creditPerLot: 9000, maxLoss: 13000 },
};

const row = buildResearchRow(snap, {});
researchRecorder.clear();
researchRecorder.record(row);
researchRecorder.record({ ...row, ts: '2026-06-27T10:00:02Z' });
researchRecorder.record({ ...row, ts: '2026-06-27T10:00:02Z' }); // dup ts → ignored

console.log('row fields        :', Object.keys(row).length);
console.log('recorded rows     :', researchRecorder.count(), '(expected 2)');
const fm = researchRecorder.featureMatrix();
console.log('feature columns   :', fm.columns.length, ' matrix rows:', fm.X.length);
console.log('CSV header (head) :', researchRecorder.exportCSV().split('\n')[0].slice(0, 90), '...');
console.log('sample features   :', fm.columns.slice(0, 6).map((c, i) => `${c}=${fm.X[0][i]}`).join(' '));
