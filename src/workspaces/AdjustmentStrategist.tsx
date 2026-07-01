import { useState } from 'react';
import { Panel } from '../components/ui/Panel';
import { useAdjust } from '../lib/adjust/useAdjust';
import { MODE_META } from '../components/adjust/shared';
import { ModeBar } from '../components/adjust/ModeBar';
import { RankedList } from '../components/adjust/RankedList';
import { DetailPanel } from '../components/adjust/DetailPanel';
import { ComparePanel } from '../components/adjust/ComparePanel';
import { ScenarioSimulator } from '../components/adjust/ScenarioSimulator';

// Adjustment Strategist — objective-driven adjustment optimizer. Standalone;
// does not modify the existing Strategy Lab or any engine.
export function AdjustmentStrategist() {
  const { position, result, mode, setMode, dte, setDte, vol } = useAdjust();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = result.candidates.find((c) => c.id === selectedId) ?? result.candidates[0];
  const accent = MODE_META[mode].color;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Optimization Mode · Position" accent={accent} className="col-start-1 col-span-4 row-start-1 row-span-2" delay={0.04}>
        <ModeBar mode={mode} setMode={setMode} dte={dte} setDte={setDte} position={position} vol={vol} evaluated={result.evaluated} />
      </Panel>

      <Panel title={`Ranked Adjustments · ${MODE_META[mode].label}`} accent={accent} className="col-start-1 col-span-4 row-start-3 row-span-4" delay={0.08}>
        <RankedList candidates={result.candidates} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      </Panel>

      <Panel title="Recommendation Detail" accent="var(--gold)" className="col-start-5 col-span-4 row-start-1 row-span-3" delay={0.12}>
        <DetailPanel candidate={selected} base={result.baseMetrics} />
      </Panel>

      <Panel title="Compare · Current vs Adjustments" accent="var(--info)" className="col-start-9 col-span-4 row-start-1 row-span-3" delay={0.16}>
        <ComparePanel base={result.baseMetrics} candidates={result.candidates} />
      </Panel>

      <Panel title="Scenario Simulator" accent="var(--violet)" className="col-start-5 col-span-8 row-start-4 row-span-3" delay={0.2}>
        <ScenarioSimulator position={position} base={result.baseLegs} candidates={result.candidates} />
      </Panel>
    </div>
  );
}
