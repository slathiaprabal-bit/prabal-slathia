import { motion } from 'motion/react';
import type { VolState, VolRegime, VolAction } from '../../lib/vol/types';

const REGIME_COLOR: Record<VolRegime, string> = {
  VERY_LOW: 'var(--info)', LOW: 'var(--info)', NORMAL: 'var(--pos)',
  ELEVATED: 'var(--gold)', HIGH: 'var(--neg)', EXTREME: 'var(--neg)',
};

const ACTION_META: Record<VolAction, { label: string; color: string }> = {
  BUY_VOL: { label: 'BUY VOL', color: 'var(--info)' },
  SELL_VOL: { label: 'SELL VOL', color: 'var(--pos)' },
  NEUTRAL: { label: 'NEUTRAL', color: 'var(--gold)' },
  WAIT: { label: 'WAIT', color: 'var(--dim)' },
};

// Presentation-only. Renders the Volatility Engine's VolState — no calculations.
export function VolEnginePanel({ v }: { v: VolState }) {
  const rc = REGIME_COLOR[v.regime];
  const am = ACTION_META[v.action];
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto pr-0.5">
      {/* Actionable signal — the headline decision, not just a score */}
      <div className="rounded-[7px] border px-2.5 py-2"
        style={{ borderColor: am.color, background: `color-mix(in srgb, ${am.color} 9%, transparent)` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.span key={v.action} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="text-[16px] font-extrabold tracking-wide" style={{ color: am.color }}>
              {am.label}
            </motion.span>
            <span className="rounded-[4px] px-1.5 py-px text-[8px] font-bold tracking-wider"
              style={{ color: rc, background: 'rgba(255,255,255,0.05)' }}>{v.regime.replace('_', ' ')}</span>
          </div>
          <div className="text-right">
            <div className="eyebrow text-[7px]">MODEL CONFIDENCE</div>
            <div className="mono text-[13px] font-bold leading-tight text-[color:var(--text)]">{v.confidence.toFixed(0)}%</div>
          </div>
        </div>
        <div className="mt-1 text-[9.5px] leading-snug text-[color:var(--dim)]">{v.actionDetail}</div>
      </div>

      {/* Score + regime bar */}
      <div>
        <div className="flex items-end justify-between">
          <div className="flex items-end gap-2">
            <span className="eyebrow text-[8px]">VOLATILITY SCORE</span>
            <span className="mono text-[16px] font-extrabold leading-none" style={{ color: rc }}>{v.score.toFixed(0)}</span>
            <span className="text-[9px] text-[color:var(--dim)]">/100</span>
          </div>
          <span className="text-[8px] text-[color:var(--faint)]">trend {v.trend.toLowerCase()}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full rounded-full" style={{ background: rc }}
            animate={{ width: `${v.score}%` }} transition={{ duration: 0.6 }} />
        </div>
      </div>

      {/* Premium / vega / transition strip */}
      <div className="grid grid-cols-2 gap-1.5">
        <Chip label="PREMIUM" value={v.premiumRichness} color={v.premiumRichness === 'RICH' ? 'var(--pos)' : v.premiumRichness === 'CHEAP' ? 'var(--info)' : 'var(--gold)'} />
        <Chip label="VEGA BIAS" value={v.vegaBias.replace('_VEGA', '')} color={v.vegaBias === 'SHORT_VEGA' ? 'var(--pos)' : v.vegaBias === 'LONG_VEGA' ? 'var(--info)' : 'var(--gold)'} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ProbBar label="EXPANSION" value={v.expansionProb} color="var(--neg)" />
        <ProbBar label="COMPRESSION" value={v.compressionProb} color="var(--pos)" />
      </div>

      {/* Drivers */}
      <div>
        <div className="eyebrow mb-1 text-[8px]">TOP DRIVERS</div>
        <div className="flex flex-col gap-1">
          {v.drivers.slice(0, 3).map((d) => {
            const c = d.contribution > 0.1 ? 'var(--neg)' : d.contribution < -0.1 ? 'var(--info)' : 'var(--dim)';
            return (
              <div key={d.key} className="flex items-center gap-2">
                <span className="w-[104px] shrink-0 truncate text-[9.5px] text-[color:var(--dim)]">{d.label}</span>
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

      {/* Institutional interpretation */}
      <div className="cell px-2.5 py-2">
        <div className="eyebrow mb-1 text-[7.5px]">MARKET INTERPRETATION</div>
        <div className="flex flex-col gap-1.5">
          {v.commentary.map((line, i) => {
            const dot = line.indexOf(' · ');
            const tag = dot > 0 ? line.slice(0, dot) : null;
            const text = dot > 0 ? line.slice(dot + 3) : line;
            return (
              <div key={i} className="text-[9.5px] leading-snug text-[color:var(--dim)]">
                {tag && <span className="mono mr-1.5 rounded-[3px] bg-white/[0.06] px-1 py-px text-[7px] font-bold tracking-wider text-[color:var(--gold)]">{tag}</span>}
                {text}
              </div>
            );
          })}
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
