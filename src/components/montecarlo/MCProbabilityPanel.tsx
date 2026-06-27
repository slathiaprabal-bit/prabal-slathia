import type { MCState } from '../../lib/montecarlo/types';
import { inr } from '../../lib/format';

// Presentation-only — strategy Monte Carlo probabilities + P&L distribution.
export function MCProbabilityPanel({ m }: { m: MCState }) {
  if (!m.ok) return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">{m.reasoning[0]}</div>;
  const evColor = m.expectedPnl >= 0 ? 'var(--pos)' : 'var(--neg)';
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="P(PROFIT)" value={`${m.pProfit.toFixed(0)}%`} color={m.pProfit >= 60 ? 'var(--pos)' : m.pProfit >= 45 ? 'var(--gold)' : 'var(--neg)'} />
        <Stat label="E[P&L]/LOT" value={inr(m.expectedPnl)} color={evColor} />
        <Stat label="MAX-PROFIT" value={`${m.pMaxProfit.toFixed(0)}%`} color="var(--info)" />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="BREAK-EVENS" value={`${m.breakevens[0]?.toLocaleString('en-IN') ?? '—'} / ${m.breakevens[1]?.toLocaleString('en-IN') ?? '—'}`} color="var(--text)" small />
        <Stat label="TOUCH P / C" value={`${m.pTouchPut?.toFixed(0) ?? '—'}% / ${m.pTouchCall?.toFixed(0) ?? '—'}%`} color="var(--gold)" small />
      </div>

      {/* P&L distribution */}
      <div className="min-h-0 flex-1">
        <div className="eyebrow mb-1 text-[8px]">P&L DISTRIBUTION · {m.paths.toLocaleString('en-IN')} GBM PATHS</div>
        <Hist hist={m.hist} />
      </div>

      <div className="cell px-2.5 py-1.5">
        <div className="flex items-start gap-1.5 text-[10px] leading-snug">
          <span className="mt-px shrink-0" style={{ color: evColor }}>▸</span>
          <span className="text-[color:var(--dim)]">{m.reasoning[0]}</span>
        </div>
      </div>
    </div>
  );
}

function Hist({ hist }: { hist: { counts: number[]; edges: number[] } }) {
  if (!hist.counts.length) return null;
  const max = Math.max(...hist.counts, 1);
  return (
    <div className="flex h-full min-h-0 items-end gap-px">
      {hist.counts.map((c, i) => {
        const mid = (hist.edges[i] + hist.edges[i + 1]) / 2;
        return <div key={i} className="flex-1 rounded-t-[1px]" style={{ height: `${(c / max) * 100}%`, background: mid >= 0 ? 'var(--pos)' : 'var(--neg)', opacity: 0.85 }} />;
      })}
    </div>
  );
}

function Stat({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="cell flex flex-col justify-center px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className={`mono ${small ? 'text-[11px]' : 'text-[14px]'} font-bold leading-tight`} style={{ color }}>{value}</div>
    </div>
  );
}
