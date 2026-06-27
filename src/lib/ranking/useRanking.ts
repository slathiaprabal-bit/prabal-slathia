import { useDecision } from '../decision/useDecision';
import { useVol } from '../vol/useVol';
import { rankStrategies } from './engine';
import type { RankedStrategy } from './types';

// Hook: ranks the strategy catalog against the live Decision Engine + VolState.
export function useRanking(): RankedStrategy[] | null {
  const d = useDecision();
  const v = useVol();
  if (!d || !v) return null;
  return rankStrategies(d, v);
}

export type { RankedStrategy } from './types';
