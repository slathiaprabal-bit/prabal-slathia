import type { SectorTilt } from '../../lib/events/types';

// Which sectors carry the most scheduled event-risk over the next 7 days.
export function SectorImpact({ sectors }: { sectors: SectorTilt[] }) {
  if (!sectors.length) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">No sector-specific event risk this week.</div>;
  }
  const max = Math.max(...sectors.map((s) => s.score), 1);
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-auto pr-0.5">
      <div className="text-[8px] leading-snug text-[color:var(--faint)]">
        Cumulative event-risk exposure (next 7 days). Higher = more scheduled catalysts.
      </div>
      {sectors.map((s) => {
        const pct = (s.score / max) * 100;
        const color = pct > 66 ? 'var(--neg)' : pct > 33 ? 'var(--gold)' : 'var(--info)';
        return (
          <div key={s.sector} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-[10px] font-semibold text-[color:var(--text)]">{s.sector}</span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: color }} />
            </div>
            <span className="mono w-5 shrink-0 text-right text-[8px] text-[color:var(--dim)]">{s.events}</span>
          </div>
        );
      })}
    </div>
  );
}
