import { computeGreeksChain } from '../greeks/engine';
import { runMonteCarlo } from '../montecarlo/engine';
import type { MCInputs, MCState } from '../montecarlo/types';
import type { HmmState } from '../hmm/types';
import type { DealerState } from '../dealer/types';
import type { DecisionOutput } from '../decision/types';
import type { RankedStrategy } from '../ranking/types';
import type { ValidationResult, ValidationReport, ValStatus, ValCategory } from './types';
import { bsPrice, probITM, wilson95, stderrProp, entropy, relErr, normCdf } from './math';

const RATE = 0.066;
const mk = (id: string, label: string, category: ValCategory, benchmark: string, value: number | null, reference: number | null, error: number | null, status: ValStatus, note: string, ci?: [number, number]): ValidationResult =>
  ({ id, label, category, benchmark, value, reference, error, status, note, ci });

// ── Greeks: engine vs finite-difference + put-call parity ──────────────────
export function validateGreeks(spot: number, dte: number, vix: number): ValidationResult[] {
  const T = Math.max(dte, 0.5) / 365;
  const sigma = vix / 100;
  const K = Math.round(spot / 50) * 50;
  const chain = computeGreeksChain({ spot, dte: Math.max(dte, 0.5), rate: RATE, lotSize: 75, rows: [{ strike: K, ceOI: 0, peOI: 0, ceIV: vix, peIV: vix }] });
  const g = chain.rows[0];

  const h = spot * 0.001, hv = 0.01;
  const P = (s: number, sg: number, call: boolean) => bsPrice(s, K, T, sg, RATE, call);
  const dFd = (P(spot + h, sigma, true) - P(spot - h, sigma, true)) / (2 * h);
  const gFd = (P(spot + h, sigma, true) - 2 * P(spot, sigma, true) + P(spot - h, sigma, true)) / (h * h);
  const vFd = (P(spot, sigma + hv, true) - P(spot, sigma - hv, true)) / 2; // per 1 vol-pt

  const dErr = relErr(g.callDelta, dFd);
  const gErr = relErr(g.callGamma, gFd);
  const vErr = relErr(g.callVega, vFd);

  // Put-call parity: C - P = S - K e^{-rT}
  const parity = P(spot, sigma, true) - P(spot, sigma, false);
  const parityRef = spot - K * Math.exp(-RATE * T);
  const pErr = Math.abs(parity - parityRef);

  const st = (e: number, w = 0.01, f = 0.03): ValStatus => (e < w ? 'PASS' : e < f ? 'WARN' : 'FAIL');
  return [
    mk('greeks.delta', 'Δ Delta vs finite-difference', 'Greeks', 'numerical dP/dS', g.callDelta, dFd, dErr, st(dErr), `rel-err ${(dErr * 100).toFixed(2)}%`),
    mk('greeks.gamma', 'Γ Gamma vs finite-difference', 'Greeks', 'numerical d²P/dS²', g.callGamma, gFd, gErr, st(gErr, 0.02, 0.06), `rel-err ${(gErr * 100).toFixed(2)}%`),
    mk('greeks.vega', 'ν Vega vs finite-difference', 'Greeks', 'numerical dP/dσ', g.callVega, vFd, vErr, st(vErr), `rel-err ${(vErr * 100).toFixed(2)}%`),
    mk('greeks.parity', 'Put-call parity', 'Greeks', 'S − K·e^{−rT}', parity, parityRef, pErr, pErr < 1 ? 'PASS' : 'WARN', `residual ₹${pErr.toFixed(2)}`),
    mk('greeks.bounds', 'Δ∈[−1,1], Γ≥0', 'Greeks', 'no-arbitrage bounds', g.callDelta, null, null, g.callDelta >= -1 && g.callDelta <= 1 && g.callGamma >= 0 ? 'PASS' : 'FAIL', 'sanity bounds'),
  ];
}

// ── Monte Carlo: vs analytical + binomial CI ───────────────────────────────
export function validateMonteCarlo(i: MCInputs, m: MCState): ValidationResult[] {
  const T = Math.max(i.dte, 0.5) / 365;
  const sigma = i.vix / 100;
  const out: ValidationResult[] = [];

  // Expected move: MC terminal dispersion vs analytical S·σ·√T.
  const emRef = i.spot * sigma * Math.sqrt(T);
  const emMc = (m.terminalP95 - m.terminalP05) / (2 * 1.6448536);
  const emErr = relErr(emMc, emRef);
  out.push(mk('mc.em', 'Expected move vs analytical', 'MonteCarlo', 'S·σ·√T', emMc, emRef, emErr, emErr < 0.05 ? 'PASS' : emErr < 0.12 ? 'WARN' : 'FAIL', `rel-err ${(emErr * 100).toFixed(1)}%`));

  // Touch probability vs analytical barrier touch (zero-drift reflection).
  if (i.shortPut != null) {
    const b = Math.log(i.shortPut / i.spot) / (sigma * Math.sqrt(T));
    const ref = 2 * normCdf(-Math.abs(b)) * 100;
    const err = Math.abs((m.pTouchPut ?? 0) - ref);
    out.push(mk('mc.touch', 'P(touch put) vs analytical', 'MonteCarlo', '2·N(−|b|) reflection', m.pTouchPut, ref, err / 100, err < 6 ? 'PASS' : err < 12 ? 'WARN' : 'FAIL', `Δ ${err.toFixed(1)}pp`));
  }

  // P(profit) binomial CI / standard error.
  const p = m.pProfit / 100;
  const se = stderrProp(p, m.paths);
  const ci = wilson95(p, m.paths);
  out.push(mk('mc.pprofit', 'P(profit) 95% CI', 'MonteCarlo', `binomial, N=${m.paths}`, m.pProfit, null, se, 'PASS', `±${(se * 196).toFixed(1)}pp`, [ci[0] * 100, ci[1] * 100]));
  return out;
}

// ── HMM: posterior / transition sanity + entropy ───────────────────────────
export function validateHmm(h: HmmState): ValidationResult[] {
  if (!h.ok) return [mk('hmm.ok', 'HMM fit', 'HMM', 'sufficient data', null, null, null, 'WARN', h.reasoning[0] ?? 'not fit')];
  const psum = h.states.reduce((s, x) => s + x.prob, 0);
  const ent = entropy(h.states.map((s) => s.prob));
  const maxEnt = Math.log(h.states.length);
  return [
    mk('hmm.posterior', 'Posterior normalisation', 'HMM', 'Σ pᵢ = 1', psum, 1, Math.abs(psum - 1), Math.abs(psum - 1) < 1e-3 ? 'PASS' : 'FAIL', `Σ=${psum.toFixed(4)}`),
    mk('hmm.entropy', 'Posterior entropy', 'HMM', `≤ ln(K)=${maxEnt.toFixed(2)}`, ent, maxEnt, ent / maxEnt, ent / maxEnt < 0.6 ? 'PASS' : 'WARN', `H=${ent.toFixed(2)} (${(100 - (ent / maxEnt) * 100).toFixed(0)}% certainty)`),
    mk('hmm.duration', 'Expected duration finite', 'HMM', '1/(1−Aᵢᵢ) > 0', h.expectedDuration, null, null, h.expectedDuration > 0 && isFinite(h.expectedDuration) ? 'PASS' : 'FAIL', `${h.expectedDuration.toFixed(0)} sessions`),
  ];
}

// ── Dealer: max-pain / walls / GEX sanity ──────────────────────────────────
export function validateDealer(d: DealerState): ValidationResult[] {
  const strikes = d.profile.map((p) => p.strike);
  const lo = Math.min(...strikes), hi = Math.max(...strikes);
  const mpIn = d.maxPain >= lo && d.maxPain <= hi;
  const wallsOrdered = d.callWall >= d.spot - 1 && d.putWall <= d.spot + 1;
  return [
    mk('dealer.maxpain', 'Max-pain within chain', 'Dealer', `[${Math.round(lo)}, ${Math.round(hi)}]`, d.maxPain, null, null, mpIn ? 'PASS' : 'FAIL', `${Math.round(d.maxPain)}`),
    mk('dealer.walls', 'Walls bracket spot', 'Dealer', 'callWall ≥ spot ≥ putWall', null, null, null, wallsOrdered ? 'PASS' : 'WARN', `${Math.round(d.putWall)} / ${Math.round(d.callWall)}`),
    mk('dealer.gex', 'Net GEX finite', 'Dealer', 'Σ Γ·OI scaled', d.netGex, null, null, isFinite(d.netGex) ? 'PASS' : 'FAIL', `${(d.netGex / 1e7).toFixed(1)} ₹Cr`),
  ];
}

// ── Ranking: internal consistency with the Decision Engine ─────────────────
export function validateRanking(decision: DecisionOutput, ranked: RankedStrategy[]): ValidationResult[] {
  const recRank = ranked.findIndex((s) => s.recommended);
  const sorted = ranked.every((s, i) => i === 0 || ranked[i - 1].score >= s.score);
  const bounded = ranked.every((s) => s.score >= 0 && s.score <= 100);
  return [
    mk('rank.agreement', 'Decision pick in top-2', 'Ranking', 'rec ∈ top fits', recRank >= 0 ? recRank + 1 : null, null, null, recRank >= 0 && recRank < 2 ? 'PASS' : recRank >= 0 ? 'WARN' : 'FAIL', recRank >= 0 ? `pick ranked #${recRank + 1}` : 'pick not in catalog'),
    mk('rank.sorted', 'Scores monotone', 'Ranking', 'descending', null, null, null, sorted ? 'PASS' : 'FAIL', 'order check'),
    mk('rank.bounds', 'Scores ∈ [0,100]', 'Ranking', 'bounded', null, null, null, bounded ? 'PASS' : 'FAIL', 'bounds check'),
  ];
}

export function buildReport(results: ValidationResult[]): ValidationReport {
  const cats = [...new Set(results.map((r) => r.category))] as ValCategory[];
  const byCategory = cats.map((category) => {
    const rs = results.filter((r) => r.category === category);
    return { category, pass: rs.filter((r) => r.status === 'PASS').length, total: rs.length };
  });
  const pass = results.filter((r) => r.status === 'PASS').length;
  return { results, passRate: results.length ? pass / results.length : 0, byCategory };
}

// Analytical ITM reference re-export for callers/tests.
export { probITM };
