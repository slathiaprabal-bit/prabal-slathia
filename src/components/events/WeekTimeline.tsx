import { IMP_COLOR, BAND_COLOR, CAT_LABEL } from './shared';
import { istDateKey, istTime } from '../../lib/events/format';
import type { MarketEvent, WeekRisk } from '../../lib/events/types';

// This Week Timeline — 7 day columns, each listing its events as chips.
export function WeekTimeline({ events, week, selectedId, onSelect }: {
  events: MarketEvent[]; week: WeekRisk; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 gap-1.5">
      {week.days.map((day) => {
        const c = BAND_COLOR[day.band];
        const dayEvents = events.filter((e) => istDateKey(new Date(e.datetime)) === day.date);
        return (
          <div key={day.date} className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 flex items-center justify-between border-b pb-0.5"
              style={{ borderColor: `color-mix(in srgb, ${c} 40%, transparent)` }}>
              <span className="text-[9px] font-bold tracking-wide" style={{ color: day.label === 'Today' ? c : 'var(--dim)' }}>
                {day.label.slice(0, 3)}
              </span>
              <span className="mono text-[8px] font-bold" style={{ color: c }}>{day.score}</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
              {dayEvents.length === 0 && <span className="text-[8px] text-[color:var(--faint)]">—</span>}
              {dayEvents.map((e) => {
                const ic = IMP_COLOR[e.importance];
                const done = e.status === 'COMPLETED';
                return (
                  <button key={e.id} onClick={() => onSelect(e.id)}
                    className="nav-item rounded-[5px] border px-1 py-0.5 text-left"
                    style={{
                      borderColor: selectedId === e.id ? ic : 'var(--line-soft)',
                      background: `color-mix(in srgb, ${ic} ${selectedId === e.id ? 10 : 5}%, transparent)`,
                      opacity: done ? 0.5 : 1,
                    }}>
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: ic }} />
                      <span className="truncate text-[9px] font-semibold text-[color:var(--text)]">{e.name}</span>
                    </div>
                    <div className="mono mt-px text-[7.5px] text-[color:var(--faint)]">
                      {istTime(new Date(e.datetime))} · {CAT_LABEL[e.category]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
