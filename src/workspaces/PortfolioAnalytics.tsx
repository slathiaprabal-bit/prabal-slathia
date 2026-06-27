import { Panel } from '../components/ui/Panel';
import { usePortfolio } from '../lib/risk/usePortfolio';
import { useBacktest } from '../lib/backtest/useBacktest';
import { GreeksAggregation } from '../components/risk/GreeksAggregation';
import { RiskAnalytics } from '../components/risk/RiskAnalytics';
import { MonteCarloProbability } from '../components/risk/MonteCarloProbability';
import { BacktestPanel } from '../components/backtest/BacktestPanel';

// Phase 2·P4 Risk Engine + Phase 3·P6 historical backtest: Greeks aggregation,
// beta, VaR, risk contribution, Monte-Carlo, and the engine's equity-curve backtest.
export function PortfolioAnalytics() {
  const p = usePortfolio();
  const bt = useBacktest();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Portfolio Greeks · Beta" accent="var(--violet)" className="col-start-1 col-span-4 row-start-1 row-span-3" delay={0.04}>
        {p ? <GreeksAggregation p={p} /> : <Empty />}
      </Panel>

      <Panel title="Risk · VaR · Contribution" accent="var(--neg)" className="col-start-1 col-span-4 row-start-4 row-span-3" delay={0.08}>
        {p ? <RiskAnalytics p={p} /> : <Empty />}
      </Panel>

      <Panel title="Historical Backtest · Equity Curve" accent="var(--pos)" className="col-start-5 col-span-4 row-start-1 row-span-6" delay={0.12}>
        {bt ? <BacktestPanel b={bt} /> : <Empty />}
      </Panel>

      <Panel title="Monte-Carlo Probability" accent="var(--info)" className="col-start-9 col-span-4 row-start-1 row-span-6" delay={0.16}>
        {p ? <MonteCarloProbability p={p} /> : <Empty />}
      </Panel>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Computing portfolio analytics…</div>;
}
