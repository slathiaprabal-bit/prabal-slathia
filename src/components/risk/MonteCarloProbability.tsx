import type { PortfolioState } from '../../lib/risk/types';
import { MonteCarloHist } from '../charts/MonteCarloHist';

// Presentation-only — Monte-Carlo probabilities from the Risk Engine + the
// return-distribution chart.
export function MonteCarloProbability({ p }: { p: PortfolioState }) {
  const m = p.mc;
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="P(PROFIT)" value={`${m.pProfit.toFixed(0)}%`} color="var(--pos)" />
        <Stat label="P(RUIN)" value={`${(m.pRuin * 100).toFixed(1)}%`} color={m.pRuin > 0.02 ? 'var(--neg)' : 'var(--pos)'} />
        <Stat label="P(DD > 20%)" value={`${(m.pDD20 * 100).toFixed(1)}%`} color={m.pDD20 > 0.1 ? 'var(--gold)' : 'var(--pos)'} />
        <Stat label="MEDIAN RETURN" value={`${m.medianReturnPct >= 0 ? '+' : ''}${m.medianReturnPct.toFixed(1)}%`} color={m.medianReturnPct >= 0 ? 'var(--pos)' : 'var(--neg)'} />
        <Stat label="E[DRAWDOWN]" value={`${(m.expectedDrawdown * 100).toFixed(1)}%`} color="var(--gold)" />
        <Stat label="WORST DD" value={`${(m.worstMaxDD * 100).toFixed(1)}%`} color="var(--neg)" />
      </div>
      <div className="min-h-0 flex-1">
        <div className="eyebrow mb-1 text-[8px]">50-TRADE RETURN DISTRIBUTION · 4,000 PATHS</div>
        <div className="h-[calc(100%-16px)]"><MonteCarloHist /></div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="cell flex flex-col justify-center px-2.5 py-1.5 text-center">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mono mt-0.5 text-[15px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
