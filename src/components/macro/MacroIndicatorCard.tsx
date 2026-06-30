import { AnimatedNumber } from '../ui/AnimatedNumber';
import type { MacroReading, MacroSignal, MacroStatus } from '../../lib/macro/types';

const SIG_COLOR: Record<MacroSignal, string> = {
  RISK_ON: 'var(--pos)',
  NEUTRAL: 'var(--gold)',
  RISK_OFF: 'var(--neg)',
};

// Institutional transparency: status drives colour + label, never hidden.
const STATUS: Record<MacroStatus, { label: string; color: string }> = {
  LIVE: { label: 'LIVE', color: 'var(--pos)' },
  DELAYED: { label: 'DELAYED', color: 'var(--gold)' },
  OFFICIAL: { label: 'OFFICIAL', color: 'var(--info)' },
  MARKET_CLOSED: { label: 'MKT CLOSED', color: 'var(--dim)' },
  NO_LIVE_DATA: { label: 'NO DATA', color: 'var(--neg)' },
};

function freshnessLabel(r: MacroReading): string {
  const { prov } = r;
  if (prov.status === 'OFFICIAL' && prov.asof) return `as of ${prov.asof}`;
  const s = prov.freshness;
  if (s == null) return '—';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Reusable macro metric tile — label · status · value/previous · interpretation.
export function MacroIndicatorCard({ r }: { r: MacroReading }) {
  const { def, value, change, signal, prov } = r;
  const st = STATUS[prov.status];
  const hasData = value != null;
  const sig = signal ? SIG_COLOR[signal] : 'var(--dim)';

  const up = (change ?? 0) >= 0;
  const changeGood = def.invertChange ? !up : up;
  const changeColor = change == null || Math.abs(change) < 1e-9
    ? 'var(--dim)' : changeGood ? 'var(--pos)' : 'var(--neg)';

  return (
    <div className="cell flex flex-col justify-between gap-1.5 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[8px]">{def.label}</span>
        <span className="flex items-center gap-1 rounded-[4px] px-1 py-px text-[7px] font-bold tracking-wider"
          style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}>
          {prov.status === 'LIVE' && <span className="h-1 w-1 rounded-full pulse" style={{ background: st.color }} />}
          {st.label}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          {hasData ? (
            <AnimatedNumber value={value as number} format={def.format} className="text-[17px] font-bold text-[color:var(--text)]" />
          ) : (
            <span className="text-[12px] font-bold tracking-wide text-[color:var(--neg)]">NO LIVE DATA</span>
          )}
          <span className="mono text-[10px]" style={{ color: changeColor }}>
            {change == null || Math.abs(change) < 1e-9 ? '—' : `${up ? '+' : ''}${formatChange(change, def.precision, def.unit)}`}
          </span>
        </div>

        {/* signal strength bar — only when a real score exists */}
        {r.score != null && (
          <div className="relative mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
            <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
            <div className="absolute top-0 h-full" style={{
              background: sig, width: `${Math.abs(r.score) * 50}%`,
              left: r.score >= 0 ? '50%' : undefined, right: r.score < 0 ? '50%' : undefined,
            }} />
          </div>
        )}
      </div>

      {/* deterministic interpretation (rule-based, no LLM) */}
      {r.interpretation && (
        <p className="line-clamp-2 text-[8.5px] leading-snug text-[color:var(--dim)]">{r.interpretation}</p>
      )}

      <div className="flex items-center justify-between text-[7px] tracking-wider text-[color:var(--faint)]">
        <span className="uppercase">{def.category}</span>
        <span className="truncate" title={prov.source}>{freshnessLabel(r)}</span>
      </div>
    </div>
  );
}

function formatChange(c: number, precision: number, unit: string) {
  if (unit === '₹Cr') return (c / 100).toFixed(0) + 'Cr';
  return c.toFixed(precision);
}
