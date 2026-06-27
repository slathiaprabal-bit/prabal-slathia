import { motion } from 'motion/react';
import type { VolState, VolRegime } from '../../lib/vol/types';

const REGIME_COLOR: Record<VolRegime, string> = {
  VERY_LOW: 'var(--info)', LOW: 'var(--info)', NORMAL: 'var(--pos)',
  ELEVATED: 'var(--gold)', HIGH: 'var(--neg)', EXTREME: 'var(--neg)',
};

// Presentation-only. Renders the Volatility Engine's VolState — no calculations.
export function VolEnginePanel({ v }: { v: VolState }) {
  const rc = REGIME_COLOR[v.regime];
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      {/* Score + regime */}
      <div>
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow text-[8px]">VOLATILITY SCORE</div>
            <div className="flex items-end gap-2">
              <motion.span key={v.score} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="mono text-[28px] font-extrabold leading-none" style={{ color: rc }}>
                {v.score.toFixed(0)}
              </motion.span>
              <span className="mb-0.5 text-[10px] text-[color:var(--dim)]">/100</span>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow text-[8px]">REGIME</div>
            <div className="text-[15px] font-bold" style={{ color: rc }}>{v.regime.replace('_', ' ')}</div>
          </div>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full rounded-full" style={{ background: rc }}
            animate={{ width: `${v.score}%` }} transition={{ duration: 0.6 }} />
        </div>
      </div>

      {/* Trend · Premium · Vega chips */}
      <div className="grid grid-cols-3 gap-1.5">
        <Chip label="TREND" value={v.trend} color={v.trend === 'RISING' ? 'var(--gold)' : v.trend === 'FALLING' ? 'var(--info)' : 'var(--dim)'} />
        <Chip label="PREMIUM" value={v.premiumRichness} color={v.premiumRichness === 'RICH' ? 'var(--pos)' : v.premiumRichness === 'CHEAP' ? 'var(--info)' : 'var(--gold)'} />
        <Chip label="VEGA BIAS" value={v.vegaBias.replace('_VEGA', '')} color={v.vegaBias === 'SHORT_VEGA' ? 'var(--pos)' : v.vegaBias === 'LONG_VEGA' ? 'var(--info)' : 'var(--gold)'} />
      </div>

      {/* Expansion / compression */}
      <div className="grid grid-cols-2 gap-2">
        <ProbBar label="EXPANSION" value={v.expansionProb} color="var(--neg)" />
        <ProbBar label="COMPRESSION" value={v.compressionProb} color="var(--pos)" />
      </div>

      {/* Drivers */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow text-[8px]">TOP DRIVERS</span>
          <span className="eyebrow text-[8px]">CONF {v.confidence.toFixed(0)}%</span>
        </div>
        <div className="flex flex-col gap-1">
          {v.drivers.slice(0, 3).map((d) => {
            const c = d.contribution > 0.1 ? 'var(--neg)' : d.contribution < -0.1 ? 'var(--info)' : 'var(--dim)';
            return (
              <div key={d.key} className="flex items-center gap-2">
                <span className="w-[110px] shrink-0 truncate text-[10px] text-[color:var(--dim)]">{d.label}</span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
                  <div className="absolute top-0 h-full" style={{ background: c, width: `${Math.abs(d.contribution) * 50}%`, left: d.contribution >= 0 ? '50%' : undefined, right: d.contribution < 0 ? '50%' : undefined }} />
                </div>
                <span className="mono w-8 shrink-0 text-right text-[9px]" style={{ color: c }}>{d.contribution > 0 ? '+' : ''}{(d.contribution * 100).toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reasoning */}
      <div className="cell px-2.5 py-2">
        <div className="flex flex-col gap-1">
          {v.reasoning.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] leading-snug">
              <span className="mt-px text-[color:var(--gold)]">▸</span>
              <span className="text-[color:var(--dim)]">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="cell flex flex-col justify-center px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mt-0.5 text-[12px] font-bold tracking-tight" style={{ color }}>{value}</div>
    </div>
  );
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="cell px-2.5 py-1.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[7px]">{label}</span>
        <span className="mono text-[11px] font-semibold" style={{ color }}>{value.toFixed(0)}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
