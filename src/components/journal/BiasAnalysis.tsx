import type { JournalState, BiasSeverity } from '../../lib/journal/types';

const SEV_COLOR: Record<BiasSeverity, string> = { LOW: 'var(--gold)', MEDIUM: 'var(--gold)', HIGH: 'var(--neg)' };

// Presentation-only — detected behavioural / emotional biases.
export function BiasAnalysis({ j }: { j: JournalState }) {
  if (!j.biases.length) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--pos)]">No behavioural leaks detected — disciplined execution.</div>;
  }
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-auto">
      {j.biases.map((b) => {
        const c = SEV_COLOR[b.severity];
        return (
          <div key={b.key} className="cell px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold tracking-tight" style={{ color: c }}>{b.label}</span>
              <span className="flex items-center gap-1.5">
                <span className="mono text-[10px] text-[color:var(--dim)]">×{b.count}</span>
                <span className="rounded-[4px] px-1.5 py-px text-[8px] font-bold tracking-wider" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>{b.severity}</span>
              </span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-snug text-[color:var(--dim)]">{b.evidence}</p>
          </div>
        );
      })}
    </div>
  );
}
