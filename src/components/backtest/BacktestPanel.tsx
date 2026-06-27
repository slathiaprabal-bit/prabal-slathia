import type { BacktestState } from '../../lib/backtest/useBacktest';
import { LineChart } from '../charts/LineChart';
import { inr } from '../../lib/format';

// Presentation-only — historical backtest equity curve + performance metrics.
export function BacktestPanel({ b }: { b: BacktestState }) {
  if (!b.ok) return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">No backtest trades generated.</div>;
  const s = b.stats;
  const eq = b.equity.map((p) => p.equity);
  const x = eq.map((_, i) => i);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="TOTAL RETURN" value={`${(s.totalReturnPct ?? 0) >= 0 ? '+' : ''}${(s.totalReturnPct ?? 0).toFixed(2)}%`} color={(s.totalReturnPct ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)'} />
        <Stat label="SHARPE" value={(s.sharpe ?? 0).toFixed(2)} color={(s.sharpe ?? 0) >= 1 ? 'var(--pos)' : 'var(--gold)'} />
        <Stat label="MAX DD" value={`${(s.maxDrawdownPct ?? 0).toFixed(2)}%`} color="var(--neg)" />
        <Stat label="CALMAR" value={b.calmar != null ? b.calmar.toFixed(2) : '—'} color="var(--info)" />
      </div>

      {/* equity curve */}
      <div className="min-h-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow text-[8px]">EQUITY CURVE · {b.equity.length} BARS</span>
          <span className="mono text-[9px] text-[color:var(--dim)]">{inr(s.sourceCapital)} → {inr(s.finalEquity)}</span>
        </div>
        <div className="h-[calc(100%-16px)]">
          {eq.length > 1 && <LineChart x={x} y={eq} color="#27d17c" yLabel="equity" />}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="WIN RATE" value={`${(s.winRatePct ?? 0).toFixed(0)}%`} color="var(--pos)" small />
        <Stat label="PROFIT FACTOR" value={(s.profitFactor ?? 0).toFixed(2)} color={(s.profitFactor ?? 0) >= 1.3 ? 'var(--pos)' : 'var(--gold)'} small />
        <Stat label="TRADES" value={`${s.trades ?? 0}`} color="var(--text)" small />
        <Stat label="₹/TRADE" value={b.returnPerTrade != null ? inr(b.returnPerTrade) : '—'} color={(b.returnPerTrade ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)'} small />
      </div>
    </div>
  );
}

function Stat({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="cell flex flex-col justify-center px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className={`mono ${small ? 'text-[12px]' : 'text-[14px]'} font-bold leading-tight`} style={{ color }}>{value}</div>
    </div>
  );
}
