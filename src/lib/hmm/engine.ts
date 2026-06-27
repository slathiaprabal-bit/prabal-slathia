import type { HmmInputs, HmmState, HmmStateInfo, HmmLabel } from './types';

const K = 3; // latent states

// Build [return, realized-vol] feature vectors from the return series.
function features(returns: number[], w: number): number[][] {
  const X: number[][] = [];
  for (let i = 0; i < returns.length; i++) {
    const lo = Math.max(0, i - w + 1);
    const win = returns.slice(lo, i + 1);
    const m = mean(win);
    const v = Math.sqrt(mean(win.map((x) => (x - m) ** 2)) || 0);
    X.push([returns[i], v]);
  }
  return X;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
function logsumexp(a: number[]): number {
  const m = Math.max(...a);
  if (!isFinite(m)) return -Infinity;
  return m + Math.log(a.reduce((s, x) => s + Math.exp(x - m), 0));
}
function logGauss(x: number[], mu: number[], varr: number[]): number {
  let s = 0;
  for (let d = 0; d < x.length; d++) {
    const vv = Math.max(varr[d], 1e-4);
    s += -0.5 * (Math.log(2 * Math.PI * vv) + (x[d] - mu[d]) ** 2 / vv);
  }
  return s;
}

// Fit a diagonal-covariance Gaussian HMM via Baum-Welch.
export function fitHmm(inputs: HmmInputs): HmmState {
  const w = inputs.volWindow ?? 5;
  const X = features(inputs.returns.filter((r) => isFinite(r)), w);
  const T = X.length, D = 2;
  if (T < 30) return notOk('Insufficient history for regime inference.');

  // ── init: order days by realized vol, split into K terciles for emissions ──
  const order = [...Array(T).keys()].sort((a, b) => X[a][1] - X[b][1]);
  let mu = Array.from({ length: K }, () => [0, 0]);
  let varr = Array.from({ length: K }, () => [1, 1]);
  for (let k = 0; k < K; k++) {
    const seg = order.slice(Math.floor((k * T) / K), Math.floor(((k + 1) * T) / K)).map((i) => X[i]);
    for (let d = 0; d < D; d++) {
      const col = seg.map((x) => x[d]);
      mu[k][d] = mean(col);
      varr[k][d] = Math.max(mean(col.map((x) => (x - mu[k][d]) ** 2)), 1e-2);
    }
  }
  let A = Array.from({ length: K }, () => Array.from({ length: K }, (_, j) => 0));
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) A[i][j] = i === j ? 0.9 : 0.1 / (K - 1);
  let pi = Array(K).fill(1 / K);

  const logEmit = () => X.map((x) => mu.map((m, k) => logGauss(x, m, varr[k])));
  let iterations = 0;

  for (let it = 0; it < 25; it++) {
    iterations++;
    const lE = logEmit();
    const lA = A.map((row) => row.map((v) => Math.log(Math.max(v, 1e-8))));
    const lPi = pi.map((v) => Math.log(Math.max(v, 1e-8)));

    // forward
    const la = Array.from({ length: T }, () => Array(K).fill(-Infinity));
    for (let k = 0; k < K; k++) la[0][k] = lPi[k] + lE[0][k];
    for (let t = 1; t < T; t++)
      for (let k = 0; k < K; k++)
        la[t][k] = lE[t][k] + logsumexp(la[t - 1].map((v, j) => v + lA[j][k]));
    // backward
    const lb = Array.from({ length: T }, () => Array(K).fill(-Infinity));
    for (let k = 0; k < K; k++) lb[T - 1][k] = 0;
    for (let t = T - 2; t >= 0; t--)
      for (let k = 0; k < K; k++)
        lb[t][k] = logsumexp(Array.from({ length: K }, (_, j) => lA[k][j] + lE[t + 1][j] + lb[t + 1][j]));

    const lZ = logsumexp(la[T - 1]);
    const gamma = la.map((row, t) => row.map((v, k) => Math.exp(v + lb[t][k] - lZ)));

    // M-step
    const newPi = gamma[0].slice();
    const newA = Array.from({ length: K }, () => Array(K).fill(0));
    const denomA = Array(K).fill(0);
    for (let t = 0; t < T - 1; t++) {
      for (let i = 0; i < K; i++) {
        denomA[i] += gamma[t][i];
        for (let j = 0; j < K; j++)
          newA[i][j] += Math.exp(la[t][i] + lA[i][j] + lE[t + 1][j] + lb[t + 1][j] - lZ);
      }
    }
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) newA[i][j] /= denomA[i] || 1;
    const newMu = Array.from({ length: K }, () => [0, 0]);
    const newVar = Array.from({ length: K }, () => [0, 0]);
    const gsum = Array(K).fill(0);
    for (let t = 0; t < T; t++) for (let k = 0; k < K; k++) {
      gsum[k] += gamma[t][k];
      for (let d = 0; d < D; d++) newMu[k][d] += gamma[t][k] * X[t][d];
    }
    for (let k = 0; k < K; k++) for (let d = 0; d < D; d++) newMu[k][d] /= gsum[k] || 1;
    for (let t = 0; t < T; t++) for (let k = 0; k < K; k++)
      for (let d = 0; d < D; d++) newVar[k][d] += gamma[t][k] * (X[t][d] - newMu[k][d]) ** 2;
    for (let k = 0; k < K; k++) for (let d = 0; d < D; d++) newVar[k][d] = Math.max(newVar[k][d] / (gsum[k] || 1), 1e-2);

    pi = newPi; A = newA; mu = newMu; varr = newVar;

    // posterior at the latest day (recompute forward only once more after loop)
    if (it === 24) return finalize(X, mu, varr, A, gamma[T - 1], iterations);
  }
  // Fallback (shouldn't reach): compute final posterior.
  const lE = logEmit();
  const lA = A.map((r) => r.map((v) => Math.log(Math.max(v, 1e-8))));
  const lPi = pi.map((v) => Math.log(Math.max(v, 1e-8)));
  const la = Array.from({ length: T }, () => Array(K).fill(-Infinity));
  for (let k = 0; k < K; k++) la[0][k] = lPi[k] + lE[0][k];
  for (let t = 1; t < T; t++) for (let k = 0; k < K; k++) la[t][k] = lE[t][k] + logsumexp(la[t - 1].map((v, j) => v + lA[j][k]));
  const lZ = logsumexp(la[T - 1]);
  const last = la[T - 1].map((v) => Math.exp(v - lZ));
  return finalize(X, mu, varr, A, last, iterations);
}

function labelOf(meanReturn: number, meanVol: number, volRank: number): HmmLabel {
  if (volRank === K - 1 && meanVol > 1.0) return 'HIGH_VOL';
  if (meanReturn > 0.05) return 'BULL';
  if (meanReturn < -0.05) return 'BEAR';
  return 'RANGE';
}

function finalize(X: number[][], mu: number[][], varr: number[][], A: number[][], posterior: number[], iterations: number): HmmState {
  // rank states by vol for labelling
  const volOrder = [...Array(K).keys()].sort((a, b) => mu[a][1] - mu[b][1]);
  const volRank = (k: number) => volOrder.indexOf(k);
  const infos: HmmStateInfo[] = Array.from({ length: K }, (_, k) => ({
    index: k,
    label: labelOf(mu[k][0], mu[k][1], volRank(k)),
    prob: posterior[k],
    meanReturn: round(mu[k][0]),
    meanVol: round(mu[k][1]),
    expectedDuration: round(Math.min(90, 1 / Math.max(1e-3, 1 - A[k][k]))),
    toCurrentNext: A[k][k],
  })).sort((a, b) => b.prob - a.prob);

  const cur = infos[0];
  const curIdx = cur.index;
  const stay = A[curIdx][curIdx];
  // most-likely next regime (excluding self)
  let nextIdx = -1, best = -1;
  for (let j = 0; j < K; j++) if (j !== curIdx && A[curIdx][j] > best) { best = A[curIdx][j]; nextIdx = j; }
  const nextLabel = nextIdx >= 0 ? infos.find((s) => s.index === nextIdx)?.label ?? null : null;

  const reasoning = [
    `HMM posterior: ${cur.label.replace('_', ' ').toLowerCase()} regime at ${(cur.prob * 100).toFixed(0)}% (μ-ret ${cur.meanReturn >= 0 ? '+' : ''}${cur.meanReturn}%, vol ${cur.meanVol}%).`,
    `Regime persistence ${(stay * 100).toFixed(0)}% — expected ~${cur.expectedDuration.toFixed(0)} sessions before a transition.`,
    nextLabel ? `Most-likely transition is toward the ${nextLabel.replace('_', ' ').toLowerCase()} regime (${(best * 100).toFixed(0)}%).` : 'Regime is strongly self-persistent.',
  ];

  return {
    ok: true, label: cur.label, confidence: round(cur.prob * 1000) / 10,
    states: infos, expectedDuration: cur.expectedDuration,
    transitionRisk: round((1 - stay) * 1000) / 10, nextRegime: nextLabel,
    iterations, reasoning,
  };
}

function notOk(msg: string): HmmState {
  return { ok: false, label: 'RANGE', confidence: 0, states: [], expectedDuration: 0, transitionRisk: 0, nextRegime: null, iterations: 0, reasoning: [msg] };
}
const round = (v: number) => Math.round(v * 100) / 100;
