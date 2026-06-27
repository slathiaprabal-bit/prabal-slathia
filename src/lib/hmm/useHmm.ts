import { useMemo } from 'react';
import { useTerminal } from '../../store';
import { fitHmm } from './engine';
import type { HmmState } from './types';

// Hook: fits the HMM over the snapshot's return history. Memoised on the series
// length so the Baum-Welch fit doesn't run every 2s frame.
export function useHmm(): HmmState | null {
  const returns = useTerminal((s) => s.snap?.history?.returns);
  const key = returns ? `${returns.length}:${returns[returns.length - 1] ?? ''}` : '';
  return useMemo(() => {
    if (!returns || returns.length < 30) return null;
    return fitHmm({ returns });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export type { HmmState } from './types';
