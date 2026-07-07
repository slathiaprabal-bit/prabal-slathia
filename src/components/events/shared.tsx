import type {
  EventImportance, ImpactRating, RecommendedAction, RiskBand, EventCategory,
  EventStatus, IVDirection, MarketEvent,
} from '../../lib/events/types';
import { istDayMonth, istTime } from '../../lib/events/format';

export const BAND_COLOR: Record<RiskBand, string> = {
  GREEN: 'var(--pos)', YELLOW: 'var(--gold)', ORANGE: '#ff8c42', RED: 'var(--neg)',
};
export const IMP_COLOR: Record<EventImportance, string> = {
  LOW: 'var(--dim)', MEDIUM: 'var(--info)', HIGH: 'var(--gold)', CRITICAL: 'var(--neg)',
};
export const CAT_LABEL: Record<EventCategory, string> = {
  INDIA_MACRO: 'INDIA', GLOBAL_MACRO: 'GLOBAL', MARKET_STRUCTURE: 'STRUCTURE', CORPORATE: 'CORP',
};
export const STATUS_COLOR: Record<EventStatus, string> = {
  SCHEDULED: 'var(--dim)', LIVE: 'var(--pos)', COMPLETED: 'var(--faint)',
};
export const IV_COLOR: Record<IVDirection, string> = {
  EXPANSION: 'var(--gold)', CRUSH: 'var(--info)', NEUTRAL: 'var(--dim)',
};

export function ratingColor(r: ImpactRating): string {
  switch (r) {
    case 'Expected IV Expansion': return 'var(--gold)';
    case 'Expected IV Crush': return 'var(--info)';
    case 'Expected Gamma Risk':
    case 'Expected Gap Risk': return 'var(--neg)';
    case 'Expected Trend Continuation': return 'var(--info)';
    case 'Expected Mean Reversion': return 'var(--violet)';
  }
}

export function actionColor(a: RecommendedAction): string {
  switch (a) {
    case 'Safe to Sell Premium':
    case 'Normal Trading Conditions': return 'var(--pos)';
    case 'Reduce Position Size':
    case 'Avoid Overnight Positions': return 'var(--gold)';
    case 'Avoid New Trades':
    case 'Wait Until Event Passes':
    case 'High Volatility Expected': return 'var(--neg)';
  }
}

export function Chip({ label, color, solid }: { label: string; color: string; solid?: boolean }) {
  return (
    <span
      className="rounded-[4px] px-1.5 py-px text-[7.5px] font-bold tracking-wider whitespace-nowrap"
      style={{
        color: solid ? 'var(--bg0)' : color,
        background: solid ? color : `color-mix(in srgb, ${color} 13%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

// Compact clickable event row used in the Today / Upcoming lists.
export function EventRow({ e, selected, onSelect }: {
  e: MarketEvent; selected?: boolean; onSelect?: (id: string) => void;
}) {
  const d = new Date(e.datetime);
  const impColor = IMP_COLOR[e.importance];
  const done = e.status === 'COMPLETED';
  return (
    <button
      onClick={() => onSelect?.(e.id)}
      className="nav-item flex w-full items-center gap-2 rounded-[6px] border px-2 py-1.5 text-left"
      style={{
        borderColor: selected ? impColor : 'var(--line-soft)',
        background: selected ? `color-mix(in srgb, ${impColor} 8%, transparent)` : undefined,
        opacity: done ? 0.55 : 1,
      }}
    >
      <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: impColor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold text-[color:var(--text)]">{e.name}</span>
          <span className="mono shrink-0 text-[8px] text-[color:var(--faint)]">{e.country}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="mono text-[8.5px] text-[color:var(--dim)]">{istDayMonth(d)} · {istTime(d)} IST</span>
          <Chip label={CAT_LABEL[e.category]} color="var(--dim)" />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="mono text-[11px] font-bold" style={{ color: done ? 'var(--faint)' : 'var(--text)' }}>
          {done ? 'done' : e.status === 'LIVE' ? 'LIVE' : e.countdown}
        </div>
        <div className="mt-0.5 text-[8px] font-bold tracking-wider" style={{ color: actionColor(e.impact.action) }}>
          {e.impact.riskScore}
        </div>
      </div>
    </button>
  );
}
