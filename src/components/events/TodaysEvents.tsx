import { EventRow } from './shared';
import type { MarketEvent } from '../../lib/events/types';

export function TodaysEvents({ events, selectedId, onSelect }: {
  events: MarketEvent[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  if (!events.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <span className="text-[12px] font-semibold text-[color:var(--pos)]">No scheduled events today</span>
        <span className="text-[10px] text-[color:var(--dim)]">Normal trading conditions — clear session.</span>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-auto pr-0.5">
      {events.map((e) => (
        <EventRow key={e.id} e={e} selected={e.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
