import { useTerminal } from '../../store';
import { buildGreeksInputs } from './inputs';
import { computeGreeksChain } from './engine';
import type { GreeksChain } from './types';

// Hook: per-strike Greeks across the live chain.
export function useGreeks(): GreeksChain | null {
  const snap = useTerminal((s) => s.snap);
  if (!snap || !snap.chain?.length) return null;
  return computeGreeksChain(buildGreeksInputs(snap));
}

export type { GreeksChain } from './types';
