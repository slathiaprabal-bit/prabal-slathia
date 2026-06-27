import { useEffect } from 'react';
import { useTerminal } from '../../store';
import { useMacro } from '../macro/useMacro';
import { useVol } from '../vol/useVol';
import { useDecision } from '../decision/useDecision';
import { usePortfolio } from '../risk/usePortfolio';
import { useDealer } from '../dealer/useDealer';
import { useHmm } from '../hmm/useHmm';
import { useMonteCarlo } from '../montecarlo/useMonteCarlo';
import { useRanking } from '../ranking/useRanking';
import { buildResearchRow } from './features';
import { researchRecorder } from './recorder';

// Continuously captures one standardized research row per market frame into the
// research recorder (matches sql/research_schema.sql). Runs once in the shell.
export function useResearchRecorder() {
  const snap = useTerminal((s) => s.snap);
  const macro = useMacro();
  const vol = useVol();
  const decision = useDecision();
  const risk = usePortfolio();
  const dealer = useDealer();
  const hmm = useHmm();
  const mc = useMonteCarlo();
  const ranking = useRanking();

  useEffect(() => {
    if (!snap) return;
    researchRecorder.record(buildResearchRow(snap, { macro: macro.regime, vol, decision, risk, dealer, hmm, mc, ranking }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.ts]);
}
