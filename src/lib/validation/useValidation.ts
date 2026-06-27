import { useMemo } from 'react';
import { useTerminal } from '../../store';
import { useHmm } from '../hmm/useHmm';
import { useDealer } from '../dealer/useDealer';
import { useDecision } from '../decision/useDecision';
import { useRanking } from '../ranking/useRanking';
import { useMonteCarlo } from '../montecarlo/useMonteCarlo';
import { buildMCInputs } from '../montecarlo/inputs';
import { validateGreeks, validateMonteCarlo, validateHmm, validateDealer, validateRanking, buildReport } from './engine';
import type { ValidationReport } from './types';

// Runs the full validation suite against the live engine outputs.
export function useValidation(): ValidationReport | null {
  const snap = useTerminal((s) => s.snap);
  const hmm = useHmm();
  const dealer = useDealer();
  const decision = useDecision();
  const ranking = useRanking();
  const mc = useMonteCarlo();

  return useMemo(() => {
    if (!snap) return null;
    const dte = snap.surface?.expiries?.[0] ?? 7;
    const results = [
      ...validateGreeks(snap.spot, dte, snap.vol.vix),
      ...(mc ? validateMonteCarlo(buildMCInputs(snap), mc) : []),
      ...(hmm ? validateHmm(hmm) : []),
      ...(dealer ? validateDealer(dealer) : []),
      ...(decision && ranking ? validateRanking(decision, ranking) : []),
    ];
    return buildReport(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.spot, snap?.vol.vix, hmm?.label, dealer?.netGex, decision?.direction, ranking?.length, mc?.pProfit]);
}

export type { ValidationReport, ValidationResult } from './types';
