import type { GreeksChain } from '../greeks/types';
import type { DealerState, GexPoint, GammaRegime } from './types';

// Dealer gamma exposure & positioning from the per-strike Greeks chain.
// Convention: dealers long calls / short puts → call gamma adds, put gamma
// subtracts. Net > 0 = long gamma (vol-suppressing / pinning); < 0 = short
// gamma (vol-amplifying). Pure and fully testable.
export function computeDealerPositioning(chain: GreeksChain, lotSize = 75): DealerState {
  const spot = chain.spot;
  const k2 = spot * spot * 0.01 * lotSize; // ₹ per 1% move scalar

  const profile: GexPoint[] = chain.rows.map((r) => ({
    strike: r.strike,
    gex: k2 * (r.callGamma * r.ceOI - r.putGamma * r.peOI),
  }));
  const netGex = profile.reduce((s, p) => s + p.gex, 0);

  // Gamma flip: strike where cumulative dealer gamma crosses zero.
  let cum = 0, flip: number | null = null;
  const ordered = [...profile].sort((a, b) => a.strike - b.strike);
  for (let i = 0; i < ordered.length; i++) {
    const prev = cum; cum += ordered[i].gex;
    if (i > 0 && Math.sign(prev) !== Math.sign(cum) && prev !== 0) {
      const t = Math.abs(prev) / (Math.abs(prev) + Math.abs(cum) || 1);
      flip = ordered[i - 1].strike + t * (ordered[i].strike - ordered[i - 1].strike);
      break;
    }
  }

  const vannaExposure = chain.rows.reduce((s, r) => s + lotSize * (r.callVanna * r.ceOI - r.putVanna * r.peOI), 0);
  const charmExposure = chain.rows.reduce((s, r) => s + lotSize * (r.callCharm * r.ceOI - r.putCharm * r.peOI), 0);

  // Max pain: expiry strike minimising total option-holder payout.
  let maxPain = spot, minPayout = Infinity;
  for (const cand of chain.rows) {
    const P = cand.strike;
    let payout = 0;
    for (const r of chain.rows) {
      if (P > r.strike) payout += r.ceOI * (P - r.strike);
      if (P < r.strike) payout += r.peOI * (r.strike - P);
    }
    if (payout < minPayout) { minPayout = payout; maxPain = P; }
  }

  // OI walls.
  let callWall = spot, callMax = -1, putWall = spot, putMax = -1;
  for (const r of chain.rows) {
    if (r.strike >= spot && r.ceOI > callMax) { callMax = r.ceOI; callWall = r.strike; }
    if (r.strike <= spot && r.peOI > putMax) { putMax = r.peOI; putWall = r.strike; }
  }

  const gammaRegime: GammaRegime = netGex >= 0 ? 'LONG_GAMMA' : 'SHORT_GAMMA';
  const reasoning = build(gammaRegime, flip, spot, maxPain, callWall, putWall, vannaExposure);

  return { spot, profile, netGex, gammaFlip: flip, vannaExposure, charmExposure, maxPain, callWall, putWall, gammaRegime, reasoning };
}

function build(reg: GammaRegime, flip: number | null, spot: number, maxPain: number, callWall: number, putWall: number, vanna: number): string[] {
  const out: string[] = [];
  out.push(reg === 'LONG_GAMMA'
    ? 'Dealers are net long gamma — flows are mean-reverting; expect intraday vol suppression and pinning toward max pain.'
    : 'Dealers are net short gamma — flows are trend-amplifying; moves can accelerate and realized vol tends to rise.');
  if (flip) out.push(`Gamma flip ~${Math.round(flip).toLocaleString('en-IN')} — ${spot > flip ? 'spot above flip (stabilising)' : 'spot below flip (destabilising)'}.`);
  out.push(`Max pain ${Math.round(maxPain).toLocaleString('en-IN')}; call wall ${Math.round(callWall).toLocaleString('en-IN')} (resistance), put wall ${Math.round(putWall).toLocaleString('en-IN')} (support).`);
  out.push(vanna < 0
    ? 'Negative vanna exposure — a vol rise pushes dealer hedging to sell, reinforcing downside.'
    : 'Positive vanna exposure — a vol rise supports dealer buying.');
  return out;
}
