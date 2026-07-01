// Derive the current live position from the snapshot. The "position" VOLARA
// models is the engine's recommended structure (short strikes from snap.trade),
// with protective wings when the structure is a defined-risk condor.
import type { Snapshot } from '../../types';
import type { Leg, Position } from './types';

const STEP = 100;
const LOT = 75; // NIFTY

export function positionFromSnapshot(snap: Snapshot | null, dte: number): Position {
  const spot = snap?.spot ?? 24000;
  const iv = Math.max(0.05, (snap?.vol.vix ?? 14) / 100);
  const ivRank = snap?.vol.ivRank ?? 50;
  const regime = snap?.regime.state ?? 'NORMAL';
  const t = snap?.trade;
  const round = (k: number) => Math.round(k / STEP) * STEP;

  let legs: Leg[] = [];
  let label = 'Short Strangle';

  const sp = t?.shortPut ?? null;
  const sc = t?.shortCall ?? null;
  if (sp && sc) {
    legs = [{ kind: 'P', strike: round(sp), qty: -1 }, { kind: 'C', strike: round(sc), qty: -1 }];
    const struct = (t?.structure ?? '').toUpperCase();
    if (struct.includes('CONDOR') || struct.includes('IRON')) {
      legs.push({ kind: 'P', strike: round(sp) - 4 * STEP, qty: 1 });
      legs.push({ kind: 'C', strike: round(sc) + 4 * STEP, qty: 1 });
      label = 'Iron Condor';
    }
  } else {
    // No live structure — a representative ATM short strangle so the tool works.
    legs = [
      { kind: 'P', strike: round(spot) - 3 * STEP, qty: -1 },
      { kind: 'C', strike: round(spot) + 3 * STEP, qty: -1 },
    ];
    label = 'Short Strangle (model)';
  }

  return { legs, spot, iv, ivRank, dte, rate: 0.066, lotSize: LOT, regime, label };
}
