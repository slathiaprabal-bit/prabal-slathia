import { AnimatedNumber } from '../ui/AnimatedNumber';
import type { MacroReading, MacroSignal } from '../../lib/macro/types';

const SIG_COLOR: Record<MacroSignal, string> = {
  RISK_ON: 'var(--pos)',
  NEUTRAL: 'var(--gold)',
  RISK_OFF: 'var(--neg)',
};
const SIG_LABEL: Record<MacroSignal, string> = {
  RISK_ON: 'RISK-ON',
  NEUTRAL: 'NEUTRAL',
  RISK_OFF: 'RISK-OFF',
};

// Reusable macro metric tile — label · live value · change · signal chip.
export function MacroIndicatorCard({ r }: { r: MacroReading }) {
  const { def, value, change, signal } = r;
  const sig = SIG_COLOR[signal];
  const up = change >= 0;
  const changeGood = def.invertChange ? !up : up;
  const changeColor = Math.abs(change) < 1e-9 ? 'var(--dim)' : changeGood ? 'var(--pos)' : 'var(--neg)';

  const SOURCE_LABEL: Record<string, string> = { live: 'LIVE', market: 'MKT', official: 'OFFICIAL' };

  return (
    <div className="cell flex flex-col justify-between gap-1.5 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[8px]">{def.label}</span>
        <span className="rounded-[4px] px-1 py-px text-[7px] font-bold tracking-wider"
          style={{ color: sig, background: `color-mix(in srgb, ${sig} 12%, transparent)` }}>
          {SIG_LABEL[signal]}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <AnimatedNumber value={value} format={def.format} className="text-[17px] font-bold text-[color:var(--text)]" />
          <span className="mono text-[10px]" style={{ color: changeColor }}>
            {Math.abs(change) < 1e-9 ? '—' : `${up ? '+' : ''}${formatChange(change, def.precision, def.unit)}`}
          </span>
        </div>
        {/* signal strength bar */}
        <div className="relative mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
          <div
            className="absolute top-0 h-full"
            style={{
              background: sig,
              width: `${Math.abs(r.score) * 50}%`,
              left: r.score >= 0 ? '50%' : undefined,
              right: r.score < 0 ? '50%' : undefined,
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[7px] tracking-wider text-[color:var(--faint)]">
        <span className="uppercase">{def.category}</span>
        <span className="flex items-center gap-1">
          {def.source === 'live' && <span className="h-1 w-1 rounded-full pulse" style={{ background: 'var(--pos)' }} />}
          {SOURCE_LABEL[def.source]}
        </span>
      </div>
    </div>
  );
}

function formatChange(c: number, precision: number, unit: string) {
  if (unit === '₹Cr') return (c / 100).toFixed(0) + 'Cr';
  return c.toFixed(precision);
}
