import { useMemo } from 'react';
import { rankVolStrategies, type VolSide } from '../../lib/vol/strategies';
import type { VolState } from '../../lib/vol/types';

const SIDE_META: Record<VolSide, { label: string; color: string }> = {
  SHORT_VOL: { label: 'SHORT VOL', color: 'var(--pos)' },
  LONG_VOL: { label: 'LONG VOL', color: 'var(--info)' },
  NEUTRAL: { label: 'NEUTRAL', color: 'var(--gold)' },
};

const fitColor = (s: number) => (s >= 70 ? 'var(--pos)' : s >= 50 ? 'var(--gold)' : 'var(--dim)');

// Option strategies ranked for the detected volatility regime (deterministic —
// scored from the Volatility Engine's state, not a generic list).
export function RecommendedStrategies({ v }: { v: VolState }) {
  const recs = useMemo(() => rankVolStrategies(v), [v]);
  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-auto pr-0.5">
      {recs.map((r, i) => {
        const sm = SIDE_META[r.side];
        return (
          <div key={r.name} className="cell px-2 py-1.5" title={r.rationale}>
            <div className="flex items-center gap-1.5">
              <span className="mono flex h-4.5 w-7 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-extrabold"
                style={{ color: fitColor(r.score), background: `color-mix(in srgb, ${fitColor(r.score)} 13%, transparent)` }}>
                {r.score}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-[color:var(--text)]">
                <span className="text-[color:var(--faint)]">#{i + 1} </span>{r.name}
              </span>
              <span className="shrink-0 rounded-[3px] px-1 py-px text-[6.5px] font-bold tracking-wider"
                style={{ color: sm.color, background: 'rgba(255,255,255,0.05)' }}>{sm.label}</span>
            </div>
            {i < 3 && <div className="mt-0.5 text-[8.5px] leading-snug text-[color:var(--dim)]">{r.rationale}</div>}
          </div>
        );
      })}
    </div>
  );
}
