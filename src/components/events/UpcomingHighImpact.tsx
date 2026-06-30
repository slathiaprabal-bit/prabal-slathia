import { EventRow } from './shared';
import type { MarketEvent } from '../../lib/events/types';

export function UpcomingHighImpact({ events, selectedId, onSelect }: {
  events: MarketEvent[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  if (!events.length) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">
        No high-impact events scheduled.
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
