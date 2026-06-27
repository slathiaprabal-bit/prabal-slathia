import { useTerminal } from '../../store';
import { useMacro } from '../macro/useMacro';
import { useVol } from '../vol/useVol';
import { runDecision } from './engine';
import type { DecisionInputs, DecisionOutput } from './types';

// Gathers upstream ENGINE OUTPUTS (macro regime + Volatility Engine VolState +
// snapshot trend/positioning/risk) into DecisionInputs and runs the composable
// decision engine. The decision layer never reads raw market data directly.
export function useDecision(): DecisionOutput | null {
  const snap = useTerminal((s) => s.snap);
  const macro = useMacro();
  const vol = useVol();
  if (!snap || !vol) return null;

  const inputs: DecisionInputs = {
    macro: { score: macro.regime.score, confidence: macro.regime.confidence },
    trend: {
      state: snap.regime.state,
      direction: snap.regime.direction,
      confidence: snap.regime.confidence,
      trendAtr: snap.regime.trendAtr,
      vixChg: snap.regime.vixChg,
    },
    vol,
    breadth: { ad: macro.byKey['breadth']?.value ?? 1, pcr: snap.positioning.pcr },
    flow: { fii: macro.byKey['fii']?.value ?? 0, dii: macro.byKey['dii']?.value ?? 0 },
    positioning: {
      pcr: snap.positioning.pcr,
      maxPain: snap.positioning.maxPain,
      spot: snap.spot,
      support: snap.positioning.support,
      resistance: snap.positioning.resistance,
      gammaFlip: snap.positioning.gammaFlip,
    },
    risk: {
      heat: snap.risk.portfolioHeat ?? 0,
      margin: snap.risk.marginUsage ?? 0,
      pRuin: snap.risk.probRuin ?? snap.montecarlo?.pRuin ?? 0,
    },
  };

  return runDecision(inputs);
}
