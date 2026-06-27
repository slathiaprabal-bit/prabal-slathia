import { useTerminal } from '../../store';
import { buildVolInputs } from './inputs';
import { computeVolState } from './engine';
import type { VolState } from './types';

// Hook: derives VolInputs from the live snapshot and runs the Volatility Engine.
// Returns the single VolState interface every consumer reads.
export function useVol(): VolState | null {
  const snap = useTerminal((s) => s.snap);
  if (!snap) return null;
  return computeVolState(buildVolInputs(snap));
}

export type { VolState } from './types';
