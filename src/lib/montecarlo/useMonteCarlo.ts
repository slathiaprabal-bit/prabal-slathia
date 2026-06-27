import { useMemo } from 'react';
import { useTerminal } from '../../store';
import { buildMCInputs } from './inputs';
import { runMonteCarlo } from './engine';
import type { MCState } from './types';

// Hook: strategy-aware Monte-Carlo over the recommended structure. Memoised on
// the structure definition so the 4k-path sim doesn't rerun every frame.
export function useMonteCarlo(): MCState | null {
  const snap = useTerminal((s) => s.snap);
  const key = snap ? `${Math.round(snap.spot)}:${snap.trade?.shortPut}:${snap.trade?.shortCall}:${snap.trade?.creditPerLot}:${Math.round(snap.vol.vix * 10)}` : '';
  return useMemo(() => {
    if (!snap) return null;
    return runMonteCarlo(buildMCInputs(snap));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export type { MCState } from './types';
