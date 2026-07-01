import { useState } from 'react';
import { Panel } from '../components/ui/Panel';
import { useAdjust } from '../lib/adjust/useAdjust';
import { MODE_META } from '../components/adjust/shared';
import { PositionLoader } from '../components/adjust/PositionLoader';
import { PositionSummary } from '../components/adjust/PositionSummary';
import { ModeBar } from '../components/adjust/ModeBar';
import { RankedList } from '../components/adjust/RankedList';
import { DetailPanel } from '../components/adjust/DetailPanel';
import { ScenarioSimulator } from '../components/adjust/ScenarioSimulator';

// Adjustment Strategist — an institutional position optimizer. A position must
// be loaded (broker import / open existing / manual) before any optimization;
// every calculation is instrument-aware and computed from the loaded position.
export function AdjustmentStrategist() {
  const a = useAdjust();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Gate: no position built yet → show the Position Builder.
  if (!a.loaded || !a.position || !a.baseMetrics) {
    return (
      <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
        <Panel title="Position Builder" accent="var(--gold)" className="col-start-2 col-span-10 row-start-1 row-span-6" delay={0.04}>
          <PositionLoader snap={a.snap} params={a.params} expiries={a.expiries} degraded={a.degraded} onLoad={a.setLoaded} />
        </Panel>
      </div>
    );
  }

  const { position, baseMetrics, result, mode, setMode, thesis, aggressiveness, dte, setDte, loaded, upcoming, degraded } = a;
  const needThesis = !thesis || !result;
  const selected = result ? (result.candidates.find((c) => c.id === selectedId) ?? result.candidates[0]) : undefined;
  const accent = MODE_META[mode].color;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Position Summary" accent="var(--info)" className="col-start-1 col-span-4 row-start-1 row-span-3" delay={0.04}>
        <PositionSummary position={position} base={baseMetrics} loaded={loaded} upcoming={upcoming} />
      </Panel>

      <Panel title="Thesis → Objective → Constraints" accent={accent} className="col-start-1 col-span-4 row-start-4 row-span-3" delay={0.08}>
        <ModeBar mode={mode} setMode={setMode} thesis={thesis} setThesis={a.setThesis}
          aggressiveness={aggressiveness} setAggressiveness={a.setAggressiveness}
          dte={dte} setDte={setDte} position={position} evaluated={result?.evaluated ?? 0} onReset={a.reset} degraded={degraded} />
      </Panel>

      <Panel title={`Ranked Adjustments · ${MODE_META[mode].label}`} accent={accent} className="col-start-5 col-span-4 row-start-1 row-span-3" delay={0.12}>
        <RankedList candidates={result?.candidates ?? []} selectedId={selected?.id ?? null} onSelect={setSelectedId} needThesis={needThesis} />
      </Panel>

      <Panel title="Recommendation Detail" accent="var(--gold)" className="col-start-5 col-span-4 row-start-4 row-span-3" delay={0.16}>
        <DetailPanel candidate={selected} base={baseMetrics} />
      </Panel>

      <Panel title="Scenario Simulator · Current vs Adjustments" accent="var(--violet)" className="col-start-9 col-span-4 row-start-1 row-span-6" delay={0.2}>
        {result
          ? <ScenarioSimulator position={position} base={result.baseLegs} candidates={result.candidates} />
          : <div className="flex h-full items-center justify-center px-4 text-center text-[10px] text-[color:var(--dim)]">Pick a market thesis to simulate current vs adjusted payoff.</div>}
      </Panel>
    </div>
  );
}
