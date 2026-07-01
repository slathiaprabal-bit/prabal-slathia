// Structure evaluation in a "P&L from now → expiry" frame (the right frame for
// adjustment decisions). All ₹ amounts are per the position's lot size.
import { bs, lognormalPdf } from './bs';
import type { Leg, Position, Metrics } from './types';

const GRID_LO = 0.80, GRID_HI = 1.20;

function mark(leg: Leg, pos: Position): number {
  return bs(pos.spot, leg.strike, pos.dte / 365, pos.iv, pos.rate, leg.kind).price;
}

function intrinsic(leg: Leg, sT: number): number {
  return leg.kind === 'C' ? Math.max(0, sT - leg.strike) : Math.max(0, leg.strike - sT);
}

// P&L from now (at current marks) to expiry at price sT, in ₹.
export function payoffFromNow(legs: Leg[], sT: number, pos: Position): number {
  let pnl = 0;
  for (const l of legs) pnl += l.qty * pos.lotSize * (intrinsic(l, sT) - mark(l, pos));
  return pnl;
}

// Net position greeks in ₹ terms.
export function greeks(legs: Leg[], pos: Position) {
  let delta = 0, gamma = 0, theta = 0, vega = 0;
  for (const l of legs) {
    const g = bs(pos.spot, l.strike, pos.dte / 365, pos.iv, pos.rate, l.kind);
    const u = l.qty * pos.lotSize;
    delta += u * g.delta;
    gamma += u * g.gamma;
    theta += u * g.theta;
    vega += u * g.vega / 100;   // per 1 vol pt
  }
  return { delta, gamma, theta, vega };
}

// Net cash to enter these legs now (credit +, debit −).
export function adjustCost(added: Leg[], pos: Position): number {
  let c = 0;
  for (const l of added) c += -l.qty * pos.lotSize * mark(l, pos);
  return c;
}

export function computeMetrics(resultLegs: Leg[], added: Leg[], pos: Position, gridN = 161): Metrics {
  const g = greeks(resultLegs, pos);

  // Expiry payoff scan.
  let maxProfit = -Infinity, maxLoss = Infinity;
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < gridN; i++) {
    const sT = pos.spot * (GRID_LO + (GRID_HI - GRID_LO) * (i / (gridN - 1)));
    const p = payoffFromNow(resultLegs, sT, pos);
    xs.push(sT); ys.push(p);
    if (p > maxProfit) maxProfit = p;
    if (p < maxLoss) maxLoss = p;
  }

  // POP = risk-neutral P(P&L > 0 at expiry) over the grid.
  let mass = 0, profitMass = 0;
  for (let i = 1; i < gridN; i++) {
    const dS = xs[i] - xs[i - 1];
    const dens = lognormalPdf(xs[i], pos.spot, pos.iv, pos.dte / 365, pos.rate) * dS;
    mass += dens;
    if (ys[i] > 0) profitMass += dens;
  }
  const pop = mass > 0 ? profitMass / mass : 0;

  // Breakevens (sign changes in payoff).
  const breakevens: number[] = [];
  for (let i = 1; i < gridN; i++) {
    if ((ys[i - 1] <= 0 && ys[i] > 0) || (ys[i - 1] >= 0 && ys[i] < 0)) {
      const t = ys[i - 1] / (ys[i - 1] - ys[i]);
      breakevens.push(Math.round(xs[i - 1] + t * (xs[i] - xs[i - 1])));
    }
  }

  // Margin estimate: min of a SPAN-ish naked charge and the defined max loss —
  // spreads get the (smaller) defined-risk margin, nakeds get SPAN.
  let shortLots = 0;
  for (const l of resultLegs) if (l.qty < 0) shortLots += -l.qty;
  const span = 0.12 * pos.spot * pos.lotSize * shortLots;
  const definedLoss = Math.abs(maxLoss);
  const margin = Math.max(0, Math.min(span || definedLoss, definedLoss || span));

  const tailPayoff = payoffFromNow(resultLegs, pos.spot - 600, pos);

  return {
    theta: g.theta, delta: g.delta, gamma: g.gamma, vega: g.vega,
    pop, maxProfit, maxLoss, margin, tailPayoff,
    adjustCost: adjustCost(added, pos), breakevens,
  };
}
