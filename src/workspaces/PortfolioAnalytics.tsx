import { Panel } from '../components/ui/Panel';
import { usePortfolio } from '../lib/risk/usePortfolio';
import { GreeksAggregation } from '../components/risk/GreeksAggregation';
import { RiskAnalytics } from '../components/risk/RiskAnalytics';
import { MonteCarloProbability } from '../components/risk/MonteCarloProbability';

// Phase 2 · Priority 4 — Portfolio Analytics on the reusable Risk Engine:
// Greeks aggregation, portfolio beta, VaR, risk contribution, margin, Monte-Carlo.
export function PortfolioAnalytics() {
  const p = usePortfolio();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Portfolio Greeks · Beta" accent="var(--violet)" className="col-start-1 col-span-5 row-start-1 row-span-3" delay={0.04}>
        {p ? <GreeksAggregation p={p} /> : <Empty />}
      </Panel>

      <Panel title="Risk · VaR · Contribution" accent="var(--neg)" className="col-start-1 col-span-5 row-start-4 row-span-3" delay={0.08}>
        {p ? <RiskAnalytics p={p} /> : <Empty />}
      </Panel>

      <Panel title="Monte-Carlo Probability" accent="var(--pos)" className="col-start-6 col-span-7 row-start-1 row-span-6" delay={0.12}>
        {p ? <MonteCarloProbability p={p} /> : <Empty />}
      </Panel>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Computing portfolio risk…</div>;
}
