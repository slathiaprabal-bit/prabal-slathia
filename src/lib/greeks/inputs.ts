import type { Snapshot } from '../../types';
import type { GreeksInputs } from './types';

const RATE = 0.066;

// Derive Greeks-engine inputs from a Snapshot's option chain.
export function buildGreeksInputs(snap: Snapshot, lotSize = 75): GreeksInputs {
  const dte = snap.surface?.expiries?.[0] ?? snap.term?.dte?.[0] ?? 7;
  return {
    spot: snap.spot,
    dte: Math.max(0.5, dte),
    rate: RATE,
    lotSize,
    rows: (snap.chain ?? []).map((r) => ({
      strike: r.strike, ceOI: r.ceOI, peOI: r.peOI, ceIV: r.ceIV, peIV: r.peIV,
    })),
  };
}
