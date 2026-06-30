import { BAND_COLOR } from './shared';
import type { WeekRisk } from '../../lib/events/types';

// Next-7-Days Risk Meter + per-day 0..100 bars (colour-coded).
export function WeekRiskScore({ week }: { week: WeekRisk }) {
  const color = BAND_COLOR[week.band];
  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow text-[8px]">NEXT 7 DAYS RISK</div>
          <div className="flex items-baseline gap-1.5">
            <span className="mono text-3xl font-extrabold leading-none" style={{ color }}>{week.overall}</span>
            <span className="text-[10px] text-[color:var(--dim)]">/100</span>
          </div>
        </div>
        <span className="rounded-[5px] px-2 py-0.5 text-[9px] font-bold tracking-widest"
          style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          {week.band}
        </span>
      </div>

      {/* diverging gradient meter with a marker */}
      <div className="relative h-2 overflow-hidden rounded-full"
        style={{ background: 'linear-gradient(90deg, var(--pos), var(--gold) 45%, #ff8c42 70%, var(--neg))' }}>
        <div className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full"
          style={{ left: `calc(${week.overall}% - 2px)`, background: '#fff', boxShadow: '0 0 0 2px var(--bg0)' }} />
      </div>

      {/* per-day rows */}
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1 overflow-auto">
        {week.days.map((d) => {
          const c = BAND_COLOR[d.band];
          return (
            <div key={d.date} className="flex items-center gap-2" title={d.topEvent ?? ''}>
              <span className="w-9 shrink-0 text-[9.5px] font-semibold text-[color:var(--dim)]">{d.label.slice(0, 3)}</span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${Math.max(2, d.score)}%`, background: c }} />
              </div>
              <span className="mono w-6 shrink-0 text-right text-[9.5px] font-bold" style={{ color: c }}>{d.score}</span>
              <span className="w-5 shrink-0 text-right text-[8px] text-[color:var(--faint)]">{d.events || ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
