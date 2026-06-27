import { useGreeks } from '../greeks/useGreeks';
import { computeDealerPositioning } from './engine';
import type { DealerState } from './types';

// Hook: dealer positioning from the live Greeks chain.
export function useDealer(): DealerState | null {
  const chain = useGreeks();
  if (!chain) return null;
  return computeDealerPositioning(chain);
}

export type { DealerState } from './types';
