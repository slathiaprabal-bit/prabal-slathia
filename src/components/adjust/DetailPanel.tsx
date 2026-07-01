import { Metric, metricRows, legStr, scoreColor, inr } from './shared';
import type { Candidate, Metrics } from '../../lib/adjust/types';

export function DetailPanel({ candidate, base }: { candidate: Candidate | undefined; base: Metrics }) {
  if (!candidate) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Select an adjustment to see full analytics.</div>;
  }
  const m = candidate.metrics;
  const sc = scoreColor(candidate.score);
  const rows = metricRows(m);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto pr-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-[color:var(--text)]">{candidate.label}</div>
          <div className="mono mt-0.5 flex flex-wrap gap-1 text-[9px] text-[color:var(--dim)]">
            {candidate.resultLegs.map((l, i) => <span key={i} className="rounded bg-white/[0.05] px-1 py-px">{legStr(l)}</span>)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="eyebrow text-[7px]">OPT. SCORE</div>
          <div className="mono text-2xl font-extrabold leading-none" style={{ color: sc }}>{candidate.score}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {rows.map((r) => <Metric key={r.label} label={r.label} value={r.value} color={r.color} />)}
      </div>

      <div className="cell px-2.5 py-1.5">
        <div className="eyebrow mb-1 text-[7.5px]">NET ADJUSTMENT</div>
        <div className="mono flex items-center justify-between text-[10px]">
          <span className="text-[color:var(--dim)]">{candidate.addedLegs.map(legStr).join('  ')}</span>
          <span style={{ color: m.adjustCost >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
            {m.adjustCost >= 0 ? 'credit ' : 'debit '}{inr(Math.abs(m.adjustCost))}
          </span>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-1 text-[7.5px]">WHY THIS RANKS HIGHEST</div>
        <ul className="flex flex-col gap-0.5">
          {candidate.reasoning.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] leading-snug text-[color:var(--dim)]">
              <span className="mt-px shrink-0" style={{ color: sc }}>▸</span><span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto text-[8px] text-[color:var(--faint)]">
        vs current: θ {inr(m.theta - base.theta)}/d · POP {((m.pop - base.pop) * 100).toFixed(0)}pts · tail {inr(m.tailPayoff - base.tailPayoff)}
      </div>
    </div>
  );
}
