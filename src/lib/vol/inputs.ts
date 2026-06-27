import type { Snapshot } from '../../types';
import type { VolInputs } from './types';

// Pure derivation of VolInputs from a Snapshot. All volatility math (ATM IV,
// term slope, skew) lives HERE — never in UI components.
export function buildVolInputs(snap: Snapshot): VolInputs {
  const { vol, smile, term, regime, spot } = snap;

  // ATM IV — front-expiry smile value at the strike nearest spot.
  let atmIv = vol.vix;
  if (smile?.strikes?.length && smile.iv.length) {
    let bi = 0, bd = Infinity;
    smile.strikes.forEach((k, idx) => { const dd = Math.abs(k - spot); if (dd < bd) { bd = dd; bi = idx; } });
    atmIv = smile.iv[bi] ?? vol.vix;
  }

  // Term slope — back minus front ATM IV across the term curve.
  let termSlope = 0;
  if (term?.iv?.length > 1) termSlope = term.iv[term.iv.length - 1] - term.iv[0];

  // Skew — 25Δ proxy: OTM-call-wing IV minus OTM-put-wing IV (downside skew < 0).
  let skew = 0;
  if (smile?.strikes?.length && smile.iv.length) {
    const at = (target: number) => {
      let bi = 0, bd = Infinity;
      smile.strikes!.forEach((k, idx) => { const dd = Math.abs(k - target); if (dd < bd) { bd = dd; bi = idx; } });
      return smile.iv[bi];
    };
    skew = at(spot * 1.05) - at(spot * 0.95);
  }

  return {
    atmIv,
    vix: vol.vix,
    vixChg: regime.vixChg ?? 0,
    ivRank: vol.ivRank ?? 50,
    ivPctile: vol.ivPctile ?? 50,
    hv: vol.hv20 ?? vol.vix,
    vrp: vol.vrp ?? 0,
    emExpiry: vol.emExpiry,
    emPct: spot ? (vol.emExpiry / spot) * 100 : 0,
    termSlope,
    skew,
    pInside1: vol.pInside1,
  };
}
