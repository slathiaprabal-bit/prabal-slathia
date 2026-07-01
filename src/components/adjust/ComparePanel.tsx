import { inr, scoreColor } from './shared';
import type { Candidate, Metrics } from '../../lib/adjust/types';

// Side-by-side: current position vs the top adjustments across every metric.
export function ComparePanel({ base, candidates }: { base: Metrics; candidates: Candidate[] }) {
  const cols = candidates.slice(0, 3);
  const rows: { label: string; get: (m: Metrics) => string; col?: (m: Metrics) => string }[] = [
    { label: 'Theta/day', get: (m) => inr(m.theta), col: (m) => (m.theta >= 0 ? 'var(--pos)' : 'var(--neg)') },
    { label: 'Delta/pt', get: (m) => m.delta.toFixed(0) },
    { label: 'Vega/pt', get: (m) => inr(m.vega) },
    { label: 'POP', get: (m) => `${(m.pop * 100).toFixed(0)}%` },
    { label: 'Max profit', get: (m) => inr(m.maxProfit), col: () => 'var(--pos)' },
    { label: 'Max loss', get: (m) => inr(m.maxLoss), col: () => 'var(--neg)' },
    { label: 'Tail (−600)', get: (m) => inr(m.tailPayoff), col: (m) => (m.tailPayoff >= 0 ? 'var(--pos)' : 'var(--neg)') },
    { label: 'Margin', get: (m) => inr(m.margin) },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="grid text-[9px]" style={{ gridTemplateColumns: `1.2fr repeat(${cols.length + 1}, 1fr)` }}>
        <div className="eyebrow sticky top-0 bg-[color:var(--panel)] py-1 text-[7px]">METRIC</div>
        <div className="sticky top-0 bg-[color:var(--panel)] py-1 text-center text-[8px] font-bold text-[color:var(--dim)]">NOW</div>
        {cols.map((c) => (
          <div key={c.id} className="sticky top-0 bg-[color:var(--panel)] py-1 text-center text-[8px] font-bold" style={{ color: scoreColor(c.score) }}>
            #{candidates.indexOf(c) + 1}
          </div>
        ))}
        {rows.map((r) => (
          <RowCells key={r.label} label={r.label} base={base} cols={cols} get={r.get} col={r.col} />
        ))}
      </div>
    </div>
  );
}

function RowCells({ label, base, cols, get, col }: {
  label: string; base: Metrics; cols: Candidate[];
  get: (m: Metrics) => string; col?: (m: Metrics) => string;
}) {
  return (
    <>
      <div className="border-t border-[color:var(--line-soft)] py-1 text-[9px] text-[color:var(--dim)]">{label}</div>
      <div className="mono border-t border-[color:var(--line-soft)] py-1 text-center text-[9px]" style={{ color: col?.(base) ?? 'var(--text)' }}>{get(base)}</div>
      {cols.map((c) => (
        <div key={c.id} className="mono border-t border-[color:var(--line-soft)] py-1 text-center text-[9px] font-semibold" style={{ color: col?.(c.metrics) ?? 'var(--text)' }}>
          {get(c.metrics)}
        </div>
      ))}
    </>
  );
}
