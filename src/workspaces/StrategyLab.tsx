import { Panel } from '../components/ui/Panel';
import { useDecision } from '../lib/decision/useDecision';
import { useMonteCarlo } from '../lib/montecarlo/useMonteCarlo';
import { useRanking } from '../lib/ranking/useRanking';
import { DecisionVerdict } from '../components/decision/DecisionVerdict';
import { DomainBreakdown } from '../components/decision/DomainBreakdown';
import { StrategyRecommendation } from '../components/decision/StrategyRecommendation';
import { MCProbabilityPanel } from '../components/montecarlo/MCProbabilityPanel';
import { StrategyRanking } from '../components/ranking/StrategyRanking';

// Phase 2 · Priority 2 — composable Decision Engine. Seven independent domains
// (macro, trend, volatility, breadth, flow, positioning, risk) fuse into a
// directional verdict, suitability, recommended structure and rationale. The
// backend strategy ranking sits alongside as the specific-structure detail.
export function StrategyLab() {
  const d = useDecision();
  const mc = useMonteCarlo();
  const ranking = useRanking();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Decision Engine" accent="var(--pos)" className="col-start-1 col-span-5 row-start-1 row-span-3" delay={0.04}>
        {d ? <DecisionVerdict d={d} /> : <Empty />}
      </Panel>

      <Panel title="Domain Signal Breakdown" accent="var(--info)" className="col-start-1 col-span-5 row-start-4 row-span-3" delay={0.08}>
        {d ? <DomainBreakdown signals={d.signals} /> : <Empty />}
      </Panel>

      <Panel title="Recommendation · Rationale" accent="var(--gold)" className="col-start-6 col-span-3 row-start-1 row-span-4" delay={0.12}>
        {d ? <StrategyRecommendation d={d} /> : <Empty />}
      </Panel>

      <Panel title="Trade Probability · Monte Carlo" accent="var(--pos)" className="col-start-6 col-span-3 row-start-5 row-span-2" delay={0.16}>
        {mc ? <MCProbabilityPanel m={mc} /> : <Empty />}
      </Panel>

      <Panel title="AI Strategy Ranking · Decision-Driven" accent="var(--violet)" className="col-start-9 col-span-4 row-start-1 row-span-6" delay={0.2}>
        {ranking ? <StrategyRanking items={ranking} /> : <Empty />}
      </Panel>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Computing decision…</div>;
}
