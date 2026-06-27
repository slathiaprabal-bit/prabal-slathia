import { useMemo } from 'react';
import { useTerminal } from '../../store';
import { runResearchBacktest } from './backtest';
import { researchRecorder } from './recorder';
import type { ResearchBacktest } from './backtest';

export interface ResearchState {
  backtest: ResearchBacktest;
  capturedRows: number;
}

// Research-validation backtest over the live return history + recorder status.
export function useResearch(): ResearchState | null {
  const returns = useTerminal((s) => s.snap?.history?.returns);
  const key = returns ? `${returns.length}:${returns[returns.length - 1] ?? ''}` : '';
  return useMemo(() => {
    if (!returns || returns.length < 40) return null;
    return { backtest: runResearchBacktest(returns), capturedRows: researchRecorder.count() };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export type { ResearchBacktest } from './backtest';
