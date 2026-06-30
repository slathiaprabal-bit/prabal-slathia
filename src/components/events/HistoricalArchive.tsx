import type { MarketEvent } from '../../lib/events/types';

// Future-ready placeholder. The backend architecture already carries a stable
// `type` key per event so Historical Event Analytics can attach occurrences
// later with no refactor — this panel previews what it will surface.
export function HistoricalArchive({ e }: { e: MarketEvent | undefined }) {
  const rows = [
    'Last 10 occurrences',
    'Average NIFTY movement',
    'Average BankNifty movement',
    'Average India VIX change',
    'IV expansion before the event',
    'IV crush after the event',
    'Best & worst performing sectors',
  ];
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[8px]">HISTORICAL EVENT ANALYTICS</span>
        <span className="rounded-[4px] px-1.5 py-px text-[7.5px] font-bold tracking-wider text-[color:var(--violet)]"
          style={{ background: 'color-mix(in srgb, var(--violet) 13%, transparent)' }}>
          COMING SOON
        </span>
      </div>
      <div className="text-[10px] leading-snug text-[color:var(--dim)]">
        Click-through impact history for{' '}
        <span className="font-semibold text-[color:var(--text)]">{e ? e.name : 'any event'}</span>
        {' '}({e ? e.type : '—'}) will appear here once the analytics provider is wired.
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
        {rows.map((r) => (
          <div key={r} className="flex items-center justify-between rounded-[5px] border border-dashed border-[color:var(--line-soft)] px-2 py-1">
            <span className="text-[9.5px] text-[color:var(--dim)]">{r}</span>
            <span className="mono text-[9px] text-[color:var(--faint)]">—</span>
          </div>
        ))}
      </div>
    </div>
  );
}
