// Shared analytical references for validation (independent of the engines).

const SQRT2PI = Math.sqrt(2 * Math.PI);
export const normPdf = (x: number) => Math.exp(-0.5 * x * x) / SQRT2PI;
export function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
export const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

export function d1d2(S: number, K: number, T: number, sigma: number, r: number) {
  const srt = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / srt;
  return { d1, d2: d1 - srt };
}

// Black-Scholes price — independent reference for finite-difference Greeks.
export function bsPrice(S: number, K: number, T: number, sigma: number, r: number, call: boolean): number {
  if (T <= 0 || sigma <= 0) return Math.max(0, call ? S - K : K - S);
  const { d1, d2 } = d1d2(S, K, T, sigma, r);
  const disc = K * Math.exp(-r * T);
  return call ? S * normCdf(d1) - disc * normCdf(d2) : disc * normCdf(-d2) - S * normCdf(-d1);
}

// Risk-neutral probability the option finishes ITM = N(d2) (call) / N(−d2) (put).
export function probITM(S: number, K: number, T: number, sigma: number, r: number, call: boolean): number {
  const { d2 } = d1d2(S, K, T, sigma, r);
  return call ? normCdf(d2) : normCdf(-d2);
}

// Wilson 95% interval for a binomial proportion p over n trials.
export function wilson95(p: number, n: number): [number, number] {
  if (n <= 0) return [0, 1];
  const z = 1.959963985;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export const stderrProp = (p: number, n: number) => (n > 0 ? Math.sqrt((p * (1 - p)) / n) : 0);

// Brier score for probabilistic calibration (lower = better).
export function brier(pred: number[], actual: number[]): number {
  if (!pred.length) return 0;
  let s = 0;
  for (let i = 0; i < pred.length; i++) s += (pred[i] - actual[i]) ** 2;
  return s / pred.length;
}

// Shannon entropy of a discrete distribution (nats).
export function entropy(p: number[]): number {
  return -p.reduce((s, x) => (x > 1e-9 ? s + x * Math.log(x) : s), 0);
}

export const relErr = (v: number, ref: number) => (Math.abs(ref) > 1e-9 ? Math.abs(v - ref) / Math.abs(ref) : Math.abs(v - ref));
