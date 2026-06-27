import { useTerminal } from '../../store';
import { buildPortfolioInputs } from './inputs';
import { computePortfolio } from './engine';
import type { PortfolioState } from './types';

// Hook: derives PortfolioInputs from the live snapshot and runs the Risk Engine.
export function usePortfolio(): PortfolioState | null {
  const snap = useTerminal((s) => s.snap);
  if (!snap) return null;
  return computePortfolio(buildPortfolioInputs(snap));
}

export type { PortfolioState } from './types';
