// Black-Scholes pricing + greeks + normal helpers. Deterministic, no deps.
// t = years, vol = decimal (0.14), r = decimal. theta returned PER DAY.

export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Abramowitz–Stegun erf approximation for the standard normal CDF.
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) p = 1 - p;
  return p;
}

export interface BSResult {
  price: number;
  delta: number;   // per 1.0 underlying
  gamma: number;
  theta: number;   // per calendar day
  vega: number;    // per 1.00 vol (i.e. +100 vol pts); divide by 100 for 1 vol pt
}

export function bs(spot: number, strike: number, t: number, vol: number,
                   r: number, kind: 'C' | 'P'): BSResult {
  if (t <= 0 || vol <= 0 || spot <= 0 || strike <= 0) {
    const intrinsic = kind === 'C' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    const delta = kind === 'C' ? (spot > strike ? 1 : 0) : (spot < strike ? -1 : 0);
    return { price: intrinsic, delta, gamma: 0, theta: 0, vega: 0 };
  }
  const srt = vol * Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (r + 0.5 * vol * vol) * t) / srt;
  const d2 = d1 - srt;
  const disc = Math.exp(-r * t);
  const pdf = normPdf(d1);
  const gamma = pdf / (spot * srt);
  const vega = spot * pdf * Math.sqrt(t);           // per 1.00 vol
  if (kind === 'C') {
    const price = spot * normCdf(d1) - strike * disc * normCdf(d2);
    const thetaY = -(spot * pdf * vol) / (2 * Math.sqrt(t)) - r * strike * disc * normCdf(d2);
    return { price, delta: normCdf(d1), gamma, theta: thetaY / 365, vega };
  }
  const price = strike * disc * normCdf(-d2) - spot * normCdf(-d1);
  const thetaY = -(spot * pdf * vol) / (2 * Math.sqrt(t)) + r * strike * disc * normCdf(-d2);
  return { price, delta: normCdf(d1) - 1, gamma, theta: thetaY / 365, vega };
}

// Risk-neutral lognormal price density at S_T given spot,vol,t (for POP).
export function lognormalPdf(sT: number, spot: number, vol: number, t: number, r: number): number {
  if (sT <= 0 || t <= 0 || vol <= 0) return 0;
  const m = Math.log(spot) + (r - 0.5 * vol * vol) * t;
  const s = vol * Math.sqrt(t);
  return normPdf((Math.log(sT) - m) / s) / (sT * s);
}
