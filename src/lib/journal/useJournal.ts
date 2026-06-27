import { useMemo } from 'react';
import { analyzeJournal } from './engine';
import { SEED_TRADES } from './data';
import type { JournalState } from './types';

// Hook: runs the journal-intelligence engine over the trade history. Swap the
// source array for a real journal feed without changing the engine or UI.
export function useJournal(): JournalState {
  return useMemo(() => analyzeJournal(SEED_TRADES), []);
}

export type { JournalState } from './types';
