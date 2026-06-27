import type { MCInputs, MCState } from './types';

// Seedable RNG (deterministic so the view doesn't flicker each render).
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function gauss(u: () => number) {
  return Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
}

// Structure P&L (per lot, ₹) at terminal price for a defined-risk credit trade.
function pnlAt(S: number, i: MCInputs): number {
  const lot = i.lotSize;
  const C = i.creditPerLot;
  let pnl = C;
  if (i.shortPut != null && S < i.shortPut) pnl = C - (i.shortPut - S) * lot;
  if (i.shortCall != null && S > i.shortCall) pnl = C - (S - i.shortCall) * lot;
  return Math.max(pnl, -i.maxLoss);
}

// Strategy-aware Monte-Carlo over GBM paths. Pure & fully testable.
export function runMonteCarlo(i: MCInputs): MCState {
  if (!i.spot || !i.dte) return notOk();
  const N = i.paths ?? 4000;
  const steps = Math.max(5, Math.min(40, Math.round(i.dte)));
  const T = i.dte / 365;
  const sigma = Math.max(0.04, i.vix / 100);
  const dt = T / steps;
  const drift = -0.5 * sigma * sigma * dt;
  const vol = sigma * Math.sqrt(dt);
  const u = rng(i.seed ?? 12345);
  const lot = i.lotSize;
  const creditPts = i.creditPerLot / lot;

  const terminals: number[] = new Array(N);
  const pnls: number[] = new Array(N);
  let touchPut = 0, touchCall = 0, maxProfit = 0, profit = 0;
  let sumPnl = 0;

  const beLo = i.shortPut != null ? i.shortPut - creditPts : null;
  const beHi = i.shortCall != null ? i.shortCall + creditPts : null;

  for (let p = 0; p < N; p++) {
    let S = i.spot, tp = false, tc = false;
    for (let k = 0; k < steps; k++) {
      S = S * Math.exp(drift + vol * gauss(u));
      if (i.shortPut != null && S <= i.shortPut) tp = true;
      if (i.shortCall != null && S >= i.shortCall) tc = true;
    }
    terminals[p] = S;
    const pl = pnlAt(S, i);
    pnls[p] = pl; sumPnl += pl;
    if (tp) touchPut++;
    if (tc) touchCall++;
    if ((i.shortPut == null || S >= i.shortPut) && (i.shortCall == null || S <= i.shortCall)) maxProfit++;
    if ((beLo == null || S >= beLo) && (beHi == null || S <= beHi)) profit++;
  }

  terminals.sort((a, b) => a - b);
  const sortedPnl = [...pnls].sort((a, b) => a - b);
  const pct = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))];

  const hist = histogram(pnls, 28);
  const sd = i.spot * sigma * Math.sqrt(T);

  return {
    ok: true, paths: N,
    pProfit: r1((profit / N) * 100),
    pMaxProfit: r1((maxProfit / N) * 100),
    pTouchPut: i.shortPut != null ? r1((touchPut / N) * 100) : null,
    pTouchCall: i.shortCall != null ? r1((touchCall / N) * 100) : null,
    expectedPnl: Math.round(sumPnl / N),
    pnlP05: Math.round(pct(sortedPnl, 0.05)), pnlP50: Math.round(pct(sortedPnl, 0.5)), pnlP95: Math.round(pct(sortedPnl, 0.95)),
    terminalP05: Math.round(pct(terminals, 0.05)), terminalP50: Math.round(pct(terminals, 0.5)), terminalP95: Math.round(pct(terminals, 0.95)),
    breakevens: [beLo != null ? Math.round(beLo) : null, beHi != null ? Math.round(beHi) : null],
    hist,
    cone: { up1: Math.round(i.spot + sd), dn1: Math.round(i.spot - sd), up2: Math.round(i.spot + 2 * sd), dn2: Math.round(i.spot - 2 * sd) },
    reasoning: build(i, profit / N, maxProfit / N, sumPnl / N, beLo, beHi),
  };
}

function histogram(xs: number[], bins: number) {
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const span = hi - lo || 1;
  const counts = new Array(bins).fill(0);
  for (const x of xs) counts[Math.min(bins - 1, Math.floor(((x - lo) / span) * bins))]++;
  const edges = Array.from({ length: bins + 1 }, (_, k) => Math.round(lo + (span * k) / bins));
  return { counts, edges };
}

function build(i: MCInputs, pProfit: number, pMax: number, ev: number, beLo: number | null, beHi: number | null): string[] {
  const out: string[] = [];
  out.push(`Monte-Carlo P(profit) ${(pProfit * 100).toFixed(0)}% over ${i.dte}d at ${i.vix.toFixed(1)} vol; expected P&L ₹${Math.round(ev).toLocaleString('en-IN')}/lot.`);
  if (beLo != null || beHi != null) out.push(`Break-evens ${beLo != null ? Math.round(beLo).toLocaleString('en-IN') : '—'} / ${beHi != null ? Math.round(beHi).toLocaleString('en-IN') : '—'}; max-profit zone held ${(pMax * 100).toFixed(0)}% of paths.`);
  out.push(ev > 0 ? 'Positive expectancy — structure is favourably priced for the simulated distribution.' : 'Negative expectancy — the simulated distribution does not favour this structure.');
  return out;
}

function notOk(): MCState {
  return { ok: false, paths: 0, pProfit: 0, pMaxProfit: 0, pTouchPut: null, pTouchCall: null, expectedPnl: 0, pnlP05: 0, pnlP50: 0, pnlP95: 0, terminalP05: 0, terminalP50: 0, terminalP95: 0, breakevens: [null, null], hist: { counts: [], edges: [] }, cone: { up1: 0, dn1: 0, up2: 0, dn2: 0 }, reasoning: ['Awaiting a tradable structure.'] };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
