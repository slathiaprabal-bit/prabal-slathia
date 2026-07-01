import { bs } from '../../lib/adjust/bs';
import { characteristics } from '../../lib/adjust/instruments';
import { inr, legStr } from './shared';
import type { LoadedPosition, Metrics, Position } from '../../lib/adjust/types';
import type { MarketEvent } from '../../lib/events/types';

export function PositionSummary({ position, base, loaded, upcoming }: {
  position: Position; base: Metrics; loaded: LoadedPosition; upcoming: MarketEvent[];
}) {
  const ch = characteristics(position.instrument);

  // Live P&L from entry prices (when the load carried them).
  let pnl: number | null = 0;
  let haveEntry = false;
  for (const l of loaded.legs) {
    if (l.entry == null) { pnl = null; continue; }
    haveEntry = true;
    const mark = bs(position.spot, l.strike, position.dte / 365, position.iv, position.rate, l.kind).price;
    if (pnl != null) pnl += l.qty * position.lotSize * (mark - l.entry);
  }
  if (!haveEntry) pnl = null;

  const em = Math.round(position.spot * position.iv * Math.sqrt(position.dte / 365));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto pr-0.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-bold text-[color:var(--text)]">{loaded.label}</div>
          <div className="text-[8px] tracking-wider text-[color:var(--faint)]">
            {ch.label} · {position.exchange} · lot {position.lotSize} · step {position.strikeStep} · {ch.liquidity} liquidity
          </div>
        </div>
        <span className="rounded-[4px] px-1.5 py-px text-[7.5px] font-bold tracking-wider text-[color:var(--gold)]"
          style={{ background: 'color-mix(in srgb, var(--gold) 13%, transparent)' }}>{loaded.source.replace('_', ' ')}</span>
      </div>

      <div className="mono flex flex-wrap gap-1 text-[10px]">
        {position.legs.map((l, i) => <span key={i} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[color:var(--text)]">{legStr(l)}</span>)}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Cell label="SPOT" value={position.spot.toLocaleString('en-IN')} />
        <Cell label="LIVE P&L" value={pnl == null ? 'n/a' : inr(pnl)} color={pnl == null ? 'var(--dim)' : pnl >= 0 ? 'var(--pos)' : 'var(--neg)'} />
        <Cell label="MARGIN" value={inr(base.margin)} />
        <Cell label="THETA" value={`${inr(base.theta)}/d`} color={base.theta >= 0 ? 'var(--pos)' : 'var(--neg)'} />
        <Cell label="DELTA" value={`${base.delta.toFixed(0)}/pt`} />
        <Cell label="VEGA" value={`${inr(base.vega)}/pt`} color={base.vega >= 0 ? 'var(--pos)' : 'var(--neg)'} />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Cell label="IV / RANK" value={`${(position.iv * 100).toFixed(1)}% · ${position.ivRank.toFixed(0)}`} />
        <Cell label="DTE" value={`${position.dte}d`} />
        <Cell label="EXP. MOVE" value={`±${em.toLocaleString('en-IN')}`} />
      </div>

      <div className="cell px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[7.5px]">MARKET REGIME</span>
          <span className="text-[10px] font-bold text-[color:var(--gold)]">{position.regime.replace(/_/g, ' ')}</span>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-1 text-[7.5px]">UPCOMING EVENTS · WITHIN DTE</div>
        {upcoming.length ? (
          <div className="flex flex-col gap-0.5">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-[9.5px]">
                <span className="truncate text-[color:var(--dim)]">{e.name}</span>
                <span className="mono shrink-0 text-[color:var(--text)]">{e.countdown}</span>
              </div>
            ))}
          </div>
        ) : <div className="text-[9px] text-[color:var(--faint)]">No scheduled events before expiry.</div>}
      </div>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="cell px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mono text-[12px] font-bold leading-tight" style={{ color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}
