import { Chip, IMP_COLOR, IV_COLOR, STATUS_COLOR, ratingColor, actionColor, CAT_LABEL } from './shared';
import { istDayMonth, istTime } from '../../lib/events/format';
import type { MarketEvent } from '../../lib/events/types';

export function EventDetails({ e }: { e: MarketEvent | undefined }) {
  if (!e) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Select an event to see its trading impact.</div>;
  }
  const d = new Date(e.datetime);
  const impColor = IMP_COLOR[e.importance];
  const actColor = actionColor(e.impact.action);
  const done = e.status === 'COMPLETED';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto pr-0.5">
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-bold text-[color:var(--text)]">{e.name}</span>
            <span className="mono text-[9px] text-[color:var(--faint)]">{e.country}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Chip label={CAT_LABEL[e.category]} color="var(--dim)" />
            <Chip label={e.importance} color={impColor} />
            <span className="mono text-[9px] text-[color:var(--dim)]">{istDayMonth(d)} · {istTime(d)} IST</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="mono text-lg font-extrabold leading-none" style={{ color: done ? 'var(--faint)' : 'var(--text)' }}>
            {done ? 'done' : e.status === 'LIVE' ? 'LIVE' : e.countdown}
          </div>
          <div className="text-[8px] font-bold tracking-wider" style={{ color: STATUS_COLOR[e.status] }}>{e.status}</div>
        </div>
      </div>

      {/* recommended action banner */}
      <div className="rounded-[7px] border px-3 py-2"
        style={{ borderColor: `color-mix(in srgb, ${actColor} 45%, transparent)`, background: `color-mix(in srgb, ${actColor} 9%, transparent)` }}>
        <div className="eyebrow text-[7.5px]">RECOMMENDED ACTION</div>
        <div className="text-[14px] font-extrabold" style={{ color: actColor }}>{e.impact.action}</div>
        <div className="mt-0.5 text-[9.5px] leading-snug text-[color:var(--dim)]">{e.impact.note}</div>
      </div>

      {/* impact ratings */}
      <div>
        <div className="eyebrow mb-1 text-[7.5px]">TRADING IMPACT RATING</div>
        <div className="flex flex-wrap gap-1">
          {e.impact.ratings.map((r) => <Chip key={r} label={r} color={ratingColor(r)} />)}
        </div>
      </div>

      {/* metrics grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="RISK SCORE" value={`${e.impact.riskScore}`} color={actColor} />
        <Mini label="RISK LEVEL" value={e.impact.riskLevel} color={actColor} small />
        <Mini label="IV" value={e.impact.ivDirection} color={IV_COLOR[e.impact.ivDirection]} small />
      </div>

      {/* markets / sectors */}
      {e.markets.length > 0 && (
        <Tags title="MARKETS AFFECTED" items={e.markets} color="var(--info)" />
      )}
      {e.sectors.length > 0 && (
        <Tags title="SECTORS AFFECTED" items={e.sectors} color="var(--gold)" />
      )}

      {/* description */}
      {e.description && <p className="text-[10px] leading-snug text-[color:var(--dim)]">{e.description}</p>}

      {/* provenance */}
      <div className="mt-auto flex items-center justify-between border-t border-[color:var(--line-soft)] pt-1.5 text-[8px] text-[color:var(--faint)]">
        <span className="truncate">
          SOURCE:{' '}
          {e.source_url
            ? <a href={e.source_url} target="_blank" rel="noreferrer" className="underline hover:text-[color:var(--dim)]">{e.source}</a>
            : e.source}
        </span>
        <span className="shrink-0">{e.last_updated ? `updated ${e.last_updated.slice(0, 10)}` : ''}</span>
      </div>
    </div>
  );
}

function Mini({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="cell flex flex-col justify-center px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className={`mono ${small ? 'text-[11px]' : 'text-[16px]'} font-bold leading-tight`} style={{ color }}>{value}</div>
    </div>
  );
}

function Tags({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="eyebrow mb-1 text-[7.5px]">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((m) => <Chip key={m} label={m} color={color} />)}
      </div>
    </div>
  );
}
