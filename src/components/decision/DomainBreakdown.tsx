import type { DomainSignal } from '../../lib/decision/types';

// Per-domain contribution: diverging bias bar + weight + conviction dot.
export function DomainBreakdown({ signals }: { signals: DomainSignal[] }) {
  const totalW = signals.reduce((s, x) => s + x.weight, 0) || 1;
  return (
    <div className="flex h-full flex-col justify-between gap-1 py-0.5">
      {signals.map((s) => {
        const color = s.bias > 0.1 ? 'var(--pos)' : s.bias < -0.1 ? 'var(--neg)' : 'var(--gold)';
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-[92px] shrink-0 truncate text-[10px] text-[color:var(--dim)]">{s.label}</span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
              <div className="absolute top-0 h-full" style={{
                background: color, width: `${Math.abs(s.bias) * 50}%`,
                left: s.bias >= 0 ? '50%' : undefined, right: s.bias < 0 ? '50%' : undefined,
              }} />
            </div>
            <span className="mono w-9 shrink-0 text-right text-[10px] font-semibold" style={{ color }}>
              {s.bias > 0 ? '+' : ''}{(s.bias * 100).toFixed(0)}
            </span>
            <span className="w-8 shrink-0 text-right text-[8px] text-[color:var(--faint)]">{(s.weight / totalW * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}
