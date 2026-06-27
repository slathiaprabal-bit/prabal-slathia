import { Panel } from '../components/ui/Panel';
import { AIDecisionPanel } from '../components/panels/AIDecisionPanel';
import { RegimePanel } from '../components/panels/RegimePanel';
import { VolMetricsPanel } from '../components/panels/VolMetricsPanel';

// Phase 1: composes the existing AI decision engine with live market-condition
// context. Phase 3 deepens this into the full institutional scoring lab.
export function StrategyLab() {
  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2.5">
      <Panel
        title="AI Decision Engine"
        accent="#16f5b0"
        className="col-start-1 col-span-8 row-start-1 row-span-6"
        delay={0.04}
      >
        <AIDecisionPanel />
      </Panel>

      <Panel
        title="Market Regime"
        className="col-start-9 col-span-4 row-start-1 row-span-2"
        delay={0.08}
      >
        <RegimePanel />
      </Panel>

      <Panel
        title="Volatility Conditions"
        accent="#3fd6f5"
        className="col-start-9 col-span-4 row-start-3 row-span-4"
        delay={0.12}
      >
        <VolMetricsPanel />
      </Panel>
    </div>
  );
}
