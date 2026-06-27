import type { JournalState, Direction, ExitReason } from '../../lib/journal/types';

const DIR_COLOR: Record<Direction, string> = { BULLISH: 'var(--pos)', NEUTRAL: 'var(--gold)', BEARISH: 'var(--neg)' };
const EXIT_LABEL: Record<ExitReason, string> = {
  TARGET: 'Target', STOP: 'Stop', TIME: 'Time', MANUAL_EARLY: 'Early', MANUAL_LATE: 'Late', ADJUSTED: 'Adjusted',
};

// Presentation-only — trade history with per-trade AI execution analysis.
export function TradeTable({ j }: { j: JournalState }) {
  const byId = Object.fromEntries(j.analyses.map((a) => [a.id, a]));
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-[1.6fr_0.8fr_0.5fr_0.6fr_0.7fr_0.7fr] gap-2 border-b border-[color:var(--line-soft)] pb-1 text-[8px] tracking-wider text-[color:var(--dim)]">
        <span>STRATEGY</span><span>BIAS</span><span className="text-right">SIZE</span><span className="text-right">R</span><span>EXIT</span><span className="text-right">EXEC</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {[...j.trades].reverse().map((t) => {
          const a = byId[t.id];
          const sc = a?.executionScore ?? 0;
          const scColor = sc >= 70 ? 'var(--pos)' : sc >= 45 ? 'var(--gold)' : 'var(--neg)';
          return (
            <div key={t.id} className="grid grid-cols-[1.6fr_0.8fr_0.5fr_0.6fr_0.7fr_0.7fr] items-center gap-2 border-b border-[color:var(--line-soft)] py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium text-[color:var(--text)]">{t.strategy}</div>
                <div className="text-[8px] text-[color:var(--faint)]">{t.date.slice(5)} · {t.regimeAtEntry}</div>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: DIR_COLOR[t.direction] }}>{t.direction.slice(0, 4)}</span>
              <span className="mono text-right text-[10px]" style={{ color: t.sizeLots > t.baselineLots * 1.25 ? 'var(--neg)' : 'var(--dim)' }}>{t.sizeLots}L</span>
              <span className="mono text-right text-[11px] font-semibold" style={{ color: t.rMultiple >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{t.rMultiple >= 0 ? '+' : ''}{t.rMultiple.toFixed(1)}</span>
              <span className="text-[10px]" style={{ color: t.exitReason === 'TARGET' ? 'var(--pos)' : t.exitReason === 'STOP' ? 'var(--dim)' : 'var(--gold)' }}>{EXIT_LABEL[t.exitReason]}</span>
              <span className="flex items-center justify-end gap-1">
                {a?.flags.length ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: scColor }} title={a.flags.join(' · ')} /> : null}
                <span className="mono text-[11px] font-semibold" style={{ color: scColor }}>{sc}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
