import type { GreeksInputs, GreeksChain, StrikeGreeks } from './types';

// Standard normal pdf / cdf.
const SQRT2PI = Math.sqrt(2 * Math.PI);
const pdf = (x: number) => Math.exp(-0.5 * x * x) / SQRT2PI;
const cdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
function erf(x: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

interface OneSide { delta: number; gamma: number; vega: number; theta: number; vanna: number; charm: number }

// Black-Scholes Greeks for one option (per unit underlying). theta/charm per day,
// vega per 1% vol — mirrors api/greeks.py exactly so frontend = backend.
function bs(spot: number, strike: number, t: number, vol: number, rate: number, call: boolean): OneSide {
  if (t <= 0 || vol <= 0 || spot <= 0 || strike <= 0) return { delta: 0, gamma: 0, vega: 0, theta: 0, vanna: 0, charm: 0 };
  const srt = vol * Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * t) / srt;
  const d2 = d1 - srt;
  const nd1 = pdf(d1);
  const delta = call ? cdf(d1) : cdf(d1) - 1;
  const gamma = nd1 / (spot * srt);
  const vega = (spot * nd1 * Math.sqrt(t)) / 100;
  const disc = rate * strike * Math.exp(-rate * t);
  const thetaY = call
    ? -(spot * nd1 * vol) / (2 * Math.sqrt(t)) - disc * cdf(d2)
    : -(spot * nd1 * vol) / (2 * Math.sqrt(t)) + disc * cdf(-d2);
  const charmY = -nd1 * (2 * rate * t - d2 * srt) / (2 * t * srt);
  const vanna = (-nd1 * d2 / vol) / 100;
  return { delta, gamma, vega, theta: thetaY / 365, vanna, charm: charmY / 365 };
}

// Per-strike Greeks across the chain — pure, fully testable.
export function computeGreeksChain(i: GreeksInputs): GreeksChain {
  const t = i.dte / 365;
  let atm = i.rows[0]?.strike ?? i.spot, bd = Infinity;
  const rows: StrikeGreeks[] = i.rows.map((r) => {
    const c = bs(i.spot, r.strike, t, r.ceIV / 100, i.rate, true);
    const p = bs(i.spot, r.strike, t, r.peIV / 100, i.rate, false);
    const d = Math.abs(r.strike - i.spot);
    if (d < bd) { bd = d; atm = r.strike; }
    return {
      strike: r.strike, ceOI: r.ceOI, peOI: r.peOI, ceIV: r.ceIV, peIV: r.peIV,
      callDelta: c.delta, putDelta: p.delta,
      callGamma: c.gamma, putGamma: p.gamma,
      callVega: c.vega, putVega: p.vega,
      callTheta: c.theta, putTheta: p.theta,
      callVanna: c.vanna, putVanna: p.vanna,
      callCharm: c.charm, putCharm: p.charm,
    };
  });
  return { spot: i.spot, dte: i.dte, rows, atmStrike: atm };
}
