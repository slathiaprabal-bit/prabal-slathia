import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useEvents } from '../../lib/events/useEvents';
import type { VolState, VolRegime, VolAction, InterpretationBlock } from '../../lib/vol/types';

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

const TONE: Record<InterpretationBlock['tone'], string> = {
  pos: 'var(--pos)', neg: 'var(--neg)', gold: 'var(--gold)', info: 'var(--info)', dim: 'var(--dim)',
};

// Presentation-only. Renders the Volatility Engine's VolState; the only panel-
// side derivation is catalyst risk, which needs the macro events feed.
export function VolEnginePanel({ v }: { v: VolState }) {
  const { events } = useEvents();
  const rc = REGIME_COLOR[v.regime];
  const am = ACTION_META[v.action];

  // Catalyst risk + risk factors from the real macro calendar (7-day window).
  const { catalyst, risks } = useMemo(() => {
    const week = events.filter((e) =>
      e.status !== 'COMPLETED' && e.msUntil != null && e.msUntil > 0 && e.msUntil <= 7 * 86400000 &&
      (e.importance === 'HIGH' || e.importance === 'CRITICAL'));
    const soon = week.filter((e) => (e.msUntil ?? 0) <= 2 * 86400000);
    const catalyst: InterpretationBlock = soon.length
      ? { label: 'CATALYST RISK', value: 'High', detail: `${soon[0].name} ${soon[0].countdown}`, tone: 'neg' }
      : week.length
        ? { label: 'CATALYST RISK', value: 'Moderate', detail: `${week[0].name} ${week[0].countdown}`, tone: 'gold' }
        : { label: 'CATALYST RISK', value: 'Low', detail: 'no major events in 7 days', tone: 'pos' };

    const risks: string[] = week.slice(0, 2).map((e) => `${e.name} · ${e.countdown}`);
    if (v.regime === 'EXTREME') risks.push('Extreme vol regime — gap / tail risk dominates');
    if (v.termSlope <= -0.4) risks.push('Term backwardation — near-dated stress priced in');
    if (v.vrp <= -2) risks.push('IV under realized — carry works against short vol');
    return { catalyst, risks };
  }, [events, v.regime, v.termSlope, v.vrp]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-auto pr-0.5">
      {/* ── MARKET STANCE ── */}
      <div className="rounded-[7px] border px-3 py-2.5"
        style={{ borderColor: am.color, background: `color-mix(in srgb, ${am.color} 8%, transparent)` }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow text-[7.5px]">MARKET STANCE</div>
            <motion.div key={v.action} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="text-[19px] font-extrabold leading-tight tracking-wide" style={{ color: am.color }}>
              {am.label}
            </motion.div>
          </div>
          <div className="text-right">
            <div className="eyebrow text-[7.5px]">MODEL CONFIDENCE</div>
            <div className="mono text-[17px] font-bold leading-tight text-[color:var(--text)]">{v.confidence.toFixed(0)}%</div>
          </div>
        </div>
        <div className="mt-1.5 text-[9.5px] leading-snug text-[color:var(--dim)]">{v.actionDetail}</div>
        <div className="mt-1.5 flex items-center justify-between border-t border-white/[0.06] pt-1.5">
          <span className="eyebrow text-[7px]">EXPECTED REGIME PERSISTENCE</span>
          <span className="mono text-[10px] font-bold text-[color:var(--text)]">{v.persistence}</span>
        </div>
      </div>

      {/* ── score strip ── */}
      <div className="flex items-center gap-2.5">
        <span className="eyebrow shrink-0 text-[7.5px]">VOL SCORE</span>
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full rounded-full" style={{ background: rc }}
            animate={{ width: `${v.score}%` }} transition={{ duration: 0.6 }} />
        </div>
        <span className="mono shrink-0 text-[12px] font-extrabold" style={{ color: rc }}>{v.score.toFixed(0)}</span>
        <span className="shrink-0 rounded-[4px] px-1.5 py-px text-[8px] font-bold tracking-wider"
          style={{ color: rc, background: `color-mix(in srgb, ${rc} 13%, transparent)` }}>{v.regime.replace('_', ' ')}</span>
      </div>

      {/* ── MARKET INTERPRETATION — 10-second research grid ── */}
      <div className="flex flex-col">
        {[...v.interpretation, catalyst].map((b) => (
          <div key={b.label} className="flex items-baseline justify-between gap-2 border-b border-[color:var(--line-soft)] py-[5px]">
            <span className="eyebrow w-[92px] shrink-0 text-[7px]">{b.label}</span>
            <span className="shrink-0 text-[11px] font-bold" style={{ color: TONE[b.tone] }}>{b.value}</span>
            <span className="mono min-w-0 flex-1 truncate text-right text-[8.5px] text-[color:var(--faint)]">{b.detail}</span>
          </div>
        ))}
      </div>

      {/* ── PRIMARY DRIVERS ── */}
      <div>
        <div className="eyebrow mb-1 text-[7.5px]">PRIMARY DRIVERS</div>
        <div className="flex flex-wrap gap-1">
          {v.drivers.slice(0, 3).map((d) => {
            const c = d.contribution > 0.1 ? 'var(--neg)' : d.contribution < -0.1 ? 'var(--info)' : 'var(--dim)';
            return (
              <span key={d.key} title={d.detail}
                className="flex items-center gap-1 rounded-[4px] border border-[color:var(--line-soft)] px-1.5 py-0.5 text-[8.5px] font-semibold text-[color:var(--text)]">
                {d.label}
                <span className="mono" style={{ color: c }}>{d.contribution > 0 ? '+' : ''}{(d.contribution * 100).toFixed(0)}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── RISK FACTORS ── */}
      <div>
        <div className="eyebrow mb-1 text-[7.5px]">RISK FACTORS</div>
        {risks.length ? (
          <div className="flex flex-col gap-0.5">
            {risks.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[9px] leading-snug text-[color:var(--dim)]">
                <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[color:var(--gold)]" />
                {r}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[9px] text-[color:var(--faint)]">No elevated risk factors in the 7-day window.</div>
        )}
      </div>
    </div>
  );
}
