import { motion } from 'motion/react';
import type { RegimeScore, MacroSignal } from '../../lib/macro/types';

const SIG_COLOR: Record<MacroSignal, string> = {
  RISK_ON: 'var(--pos)',
  NEUTRAL: 'var(--gold)',
  RISK_OFF: 'var(--neg)',
};

// Overall Market Regime score — diverging -100..+100 meter + drivers.
export function MacroRegimeGauge({ regime }: { regime: RegimeScore }) {
  const color = SIG_COLOR[regime.signal];
  const pct = (regime.score + 100) / 2; // 0..100 position
  const interp =
    regime.signal === 'RISK_ON'
      ? 'Risk appetite firm — directional / long-delta structures favoured.'
      : regime.signal === 'RISK_OFF'
      ? 'Risk-off backdrop — defensive, hedged or reduced exposure.'
      : 'Mixed macro — favour neutral, range-bound premium-selling structures.';

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="eyebrow text-[8px]">MARKET REGIME SCORE</div>
        <div className="mt-1 flex items-end gap-2">
          <motion.div
            key={regime.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-extrabold tracking-tight"
            style={{ color }}
          >
            {regime.label}
          </motion.div>
          <span className="mono mb-0.5 text-sm font-bold" style={{ color }}>
            {regime.score > 0 ? '+' : ''}{regime.score.toFixed(0)}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[color:var(--dim)]">{interp}</p>
      </div>

      {/* Diverging meter */}
      <div>
        <div className="relative h-2 overflow-hidden rounded-full"
          style={{ background: 'linear-gradient(90deg, color-mix(in srgb,var(--neg) 55%,transparent), rgba(255,255,255,0.06) 50%, color-mix(in srgb,var(--pos) 55%,transparent))' }}>
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
          <motion.div
            className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full"
            style={{ background: color, boxShadow: `0 0 0 2px var(--bg0)` }}
            animate={{ left: `calc(${pct}% - 2px)` }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[8px] tracking-wider text-[color:var(--dim)]">
          <span>RISK-OFF</span><span>NEUTRAL</span><span>RISK-ON</span>
        </div>
      </div>

      {/* Confidence + drivers */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow text-[8px]">CONFIDENCE</span>
          <span className="mono text-[11px] font-semibold" style={{ color }}>{regime.confidence.toFixed(0)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full" style={{ width: `${regime.confidence}%`, background: color }} />
        </div>
        <div className="eyebrow mt-2 text-[8px]">KEY DRIVERS</div>
        <div className="mt-1 flex flex-col gap-0.5">
          {regime.drivers.map((d) => (
            <div key={d.label} className="flex items-center justify-between text-[10px]">
              <span className="text-[color:var(--dim)]">{d.label}</span>
              <span className="mono font-semibold" style={{ color: d.score > 0.1 ? 'var(--pos)' : d.score < -0.1 ? 'var(--neg)' : 'var(--gold)' }}>
                {d.score > 0 ? '+' : ''}{(d.score * 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
