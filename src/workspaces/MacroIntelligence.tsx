import { Panel } from '../components/ui/Panel';
import { useMacro } from '../lib/macro/useMacro';
import { MacroRegimeGauge } from '../components/macro/MacroRegimeGauge';
import { MacroCategoryBar } from '../components/macro/MacroCategoryBar';
import { MacroIndicatorCard } from '../components/macro/MacroIndicatorCard';

// Phase 2 · Priority 1 — Macro Intelligence engine. Weighted multi-asset
// regime model: FX, rates, commodities, growth, volatility, flows, breadth.
export function MacroIntelligence() {
  const { readings, regime } = useMacro();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Market Regime Score" accent="var(--gold)" className="col-start-1 col-span-4 row-start-1 row-span-4" delay={0.04}>
        <MacroRegimeGauge regime={regime} />
      </Panel>

      <Panel title="Category Contribution" accent="var(--violet)" className="col-start-1 col-span-4 row-start-5 row-span-2" delay={0.08}>
        <MacroCategoryBar cats={regime.byCategory} />
      </Panel>

      <Panel title="Global Macro Dashboard" accent="var(--info)" className="col-start-5 col-span-8 row-start-1 row-span-6" delay={0.12}>
        <div className="grid h-full auto-rows-fr grid-cols-4 gap-2">
          {readings.map((r) => (
            <MacroIndicatorCard key={r.def.key} r={r} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
