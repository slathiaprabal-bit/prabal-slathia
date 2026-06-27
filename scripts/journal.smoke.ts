// Smoke test for the Trade Journal Intelligence engine — runs the analytics in
// isolation. Run: npx tsx scripts/journal.smoke.ts
import { analyzeJournal } from '../src/lib/journal/engine';
import { SEED_TRADES } from '../src/lib/journal/data';

const j = analyzeJournal(SEED_TRADES);
console.log('trades:', j.stats.count, ' winRate:', (j.stats.winRate * 100).toFixed(0) + '%',
  ' expectancy:', j.stats.expectancyR + 'R', ' profitFactor:', j.stats.profitFactor,
  ' totalPnl: ₹' + j.stats.totalPnl.toLocaleString('en-IN'));
console.log('execution score:', j.executionScore, ' emotional score:', j.emotionalScore,
  ' planAdherence:', (j.stats.planAdherence * 100).toFixed(0) + '%');
console.log('\nbiases:');
for (const b of j.biases) console.log(`  [${b.severity}] ${b.label} ×${b.count} — ${b.evidence}`);
console.log('\nsuggestions:');
for (const s of j.suggestions) console.log('  • ' + s);
console.log('\nworst-executed trades:');
for (const a of [...j.analyses].sort((x, y) => x.executionScore - y.executionScore).slice(0, 3))
  console.log(`  ${a.id} score ${a.executionScore} — ${a.note}`);
