import type { Snapshot } from '../../types';
import type { MCInputs } from './types';

export function buildMCInputs(snap: Snapshot, lotSize = 75): MCInputs {
  const dte = snap.surface?.expiries?.[0] ?? snap.term?.dte?.[0] ?? 7;
  return {
    spot: snap.spot,
    vix: snap.vol.vix,
    dte: Math.max(0.5, dte),
    lotSize,
    shortPut: snap.trade?.shortPut ?? null,
    shortCall: snap.trade?.shortCall ?? null,
    creditPerLot: snap.trade?.creditPerLot ?? 0,
    maxLoss: snap.trade?.maxLoss || snap.risk?.capitalAtRisk || 13000,
  };
}
