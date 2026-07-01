// Scenario simulator: mark-to-market P&L for a structure under a price move, an
// IV shift, and a chosen remaining-DTE (days passed). Deterministic BS revalue.
import { bs } from './bs';
import type { Leg, Position, ScenarioResult } from './types';

export function structureValue(legs: Leg[], spot: number, iv: number, dte: number, pos: Position): number {
  let v = 0;
  for (const l of legs) v += l.qty * pos.lotSize * bs(spot, l.strike, Math.max(0, dte) / 365, Math.max(0.001, iv), pos.rate, l.kind).price;
  return v;
}

// P&L from the current mark to a scenario (newSpot, newIv, dteRemaining).
export function scenarioPnL(legs: Leg[], pos: Position, spot: number, iv: number, dte: number): number {
  return structureValue(legs, spot, iv, dte, pos) - structureValue(legs, pos.spot, pos.iv, pos.dte, pos);
}

// A P&L curve across underlying moves for fixed ivShift + remaining DTE.
export function scenarioCurve(
  legs: Leg[], pos: Position,
  ivShift = 0, dteRemaining = pos.dte, points = 49, rangePct = 0.08,
): ScenarioResult[] {
  const out: ScenarioResult[] = [];
  for (let i = 0; i < points; i++) {
    const move = -rangePct + (2 * rangePct * i) / (points - 1);
    const s = pos.spot * (1 + move);
    out.push({ priceMovePct: move * 100, pnl: scenarioPnL(legs, pos, s, pos.iv + ivShift, dteRemaining) });
  }
  return out;
}
