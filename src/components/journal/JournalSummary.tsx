import type { JournalState } from '../../lib/journal/types';
import { inr } from '../../lib/format';

// Presentation-only — expectancy KPIs + execution / discipline scores.
export function JournalSummary({ j }: { j: JournalState }) {
  const s = j.stats;
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="WIN RATE" value={`${(s.winRate * 100).toFixed(0)}%`} color={s.winRate >= 0.5 ? 'var(--pos)' : 'var(--neg)'} />
        <Kpi label="EXPECTANCY" value={`${s.expectancyR >= 0 ? '+' : ''}${s.expectancyR.toFixed(2)}R`} color={s.expectancyR >= 0 ? 'var(--pos)' : 'var(--neg)'} />
        <Kpi label="PROFIT FACTOR" value={s.profitFactor.toFixed(2)} color={s.profitFactor >= 1.3 ? 'var(--pos)' : s.profitFactor >= 1 ? 'var(--gold)' : 'var(--neg)'} />
        <Kpi label="NET P&L" value={inr(s.totalPnl)} color={s.totalPnl >= 0 ? 'var(--pos)' : 'var(--neg)'} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ScoreBar label="EXECUTION QUALITY" value={j.executionScore} />
        <ScoreBar label="DISCIPLINE / EMOTIONAL" value={j.emotionalScore} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Mini label="TRADES" value={`${s.count}`} />
        <Mini label="PLAN ADHERENCE" value={`${(s.planAdherence * 100).toFixed(0)}%`} />
        <Mini label="AVG HOLD" value={`${s.avgHoldDays.toFixed(1)}d`} />
      </div>
    </div>
  );
}

function color(v: number) { return v >= 70 ? 'var(--pos)' : v >= 45 ? 'var(--gold)' : 'var(--neg)'; }

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="cell flex flex-col justify-center px-2.5 py-2">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mono mt-0.5 text-[16px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const c = color(value);
  return (
    <div className="cell px-2.5 py-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[8px]">{label}</span>
        <span className="mono text-[13px] font-bold" style={{ color: c }}>{value.toFixed(0)}<span className="text-[8px] text-[color:var(--dim)]">/100</span></span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: c }} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="cell px-2.5 py-1.5 text-center">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mono mt-0.5 text-[13px] font-semibold text-[color:var(--text)]">{value}</div>
    </div>
  );
}
