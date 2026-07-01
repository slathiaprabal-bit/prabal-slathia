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

  // Gate: no position loaded yet → show the Position Loader.
  if (!a.loaded || !a.position || !a.result) {
    return (
      <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
        <Panel title="Position Builder" accent="var(--gold)" className="col-start-2 col-span-10 row-start-1 row-span-6" delay={0.04}>
          <PositionLoader snap={a.snap} params={a.params} expiries={a.expiries} degraded={a.degraded} onLoad={a.setLoaded} />
        </Panel>
      </div>
    );
  }

  const { position, result, mode, setMode, dte, setDte, loaded, upcoming, degraded } = a;
  const selected = result.candidates.find((c) => c.id === selectedId) ?? result.candidates[0];
  const accent = MODE_META[mode].color;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Position Summary" accent="var(--info)" className="col-start-1 col-span-4 row-start-1 row-span-3" delay={0.04}>
        <PositionSummary position={position} base={result.baseMetrics} loaded={loaded} upcoming={upcoming} />
      </Panel>

      <Panel title="Optimization Objective" accent={accent} className="col-start-1 col-span-4 row-start-4 row-span-3" delay={0.08}>
        <ModeBar mode={mode} setMode={setMode} dte={dte} setDte={setDte} position={position} evaluated={result.evaluated} onReset={a.reset} degraded={degraded} />
      </Panel>

      <Panel title={`Ranked Adjustments · ${MODE_META[mode].label}`} accent={accent} className="col-start-5 col-span-4 row-start-1 row-span-3" delay={0.12}>
        <RankedList candidates={result.candidates} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      </Panel>

      <Panel title="Recommendation Detail" accent="var(--gold)" className="col-start-5 col-span-4 row-start-4 row-span-3" delay={0.16}>
        <DetailPanel candidate={selected} base={result.baseMetrics} />
      </Panel>

      <Panel title="Scenario Simulator · Current vs Adjustments" accent="var(--violet)" className="col-start-9 col-span-4 row-start-1 row-span-6" delay={0.2}>
        <ScenarioSimulator position={position} base={result.baseLegs} candidates={result.candidates} />
      </Panel>
    </div>
  );
}
