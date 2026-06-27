// Smoke test for the Hidden Markov Regime engine. Run: npx tsx scripts/hmm.smoke.ts
import { fitHmm } from '../src/lib/hmm/engine';

// Deterministic pseudo-random.
let s = 42;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const gauss = (m: number, sd: number) => m + sd * Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

function regime(name: string, segs: [number, number, number][]) {
  const r: number[] = [];
  for (const [n, m, sd] of segs) for (let i = 0; i < n; i++) r.push(gauss(m, sd));
  const h = fitHmm({ returns: r });
  console.log(`\n=== ${name} (${r.length} days, ${h.iterations} EM iters) ===`);
  console.log(`  current regime : ${h.label}  (${h.confidence}% confidence)`);
  console.log(`  expected dur   : ${h.expectedDuration} sessions   transition risk: ${h.transitionRisk}%`);
  console.log(`  next regime    : ${h.nextRegime}`);
  console.log('  states:');
  for (const st of h.states) console.log(`    ${st.label.padEnd(9)} p=${(st.prob * 100).toFixed(0)}% μret=${st.meanReturn} vol=${st.meanVol} dur=${st.expectedDuration}`);
}

// Bull → Crisis → ends in a calm range.
regime('Bull → Crisis → Range', [[90, 0.35, 0.6], [50, -0.6, 2.2], [70, 0.02, 0.5]]);
// Ends in a high-vol bear.
regime('Calm → ends in Bear/HighVol', [[100, 0.1, 0.5], [60, -0.5, 2.4]]);
