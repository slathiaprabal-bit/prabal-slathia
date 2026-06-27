import { motion } from 'motion/react';
import type { HmmState, HmmLabel } from '../../lib/hmm/types';

const LABEL_COLOR: Record<HmmLabel, string> = {
  BULL: 'var(--pos)', BEAR: 'var(--neg)', RANGE: 'var(--gold)', HIGH_VOL: 'var(--violet)',
};
const LABEL_TEXT: Record<HmmLabel, string> = {
  BULL: 'BULL', BEAR: 'BEAR', RANGE: 'RANGE', HIGH_VOL: 'HIGH VOL',
};

// Presentation-only — Hidden Markov Model regime posterior + dynamics.
export function HmmRegimePanel({ h }: { h: HmmState }) {
  if (!h.ok) return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">{h.reasoning[0]}</div>;
  const c = LABEL_COLOR[h.label];
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div>
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow text-[8px]">HMM REGIME · {h.iterations} EM ITERS</div>
            <motion.div key={h.label} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="text-[22px] font-extrabold leading-none tracking-tight" style={{ color: c }}>
              {LABEL_TEXT[h.label]}
            </motion.div>
          </div>
          <div className="text-right">
            <div className="eyebrow text-[8px]">CONFIDENCE</div>
            <div className="mono text-lg font-bold" style={{ color: c }}>{h.confidence.toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* state posteriors */}
      <div className="flex flex-col gap-1">
        {h.states.map((s) => {
          const sc = LABEL_COLOR[s.label];
          return (
            <div key={s.index} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[9px] font-semibold" style={{ color: sc }}>{LABEL_TEXT[s.label]}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full" style={{ width: `${s.prob * 100}%`, background: sc }} />
              </div>
              <span className="mono w-8 shrink-0 text-right text-[9px]" style={{ color: sc }}>{(s.prob * 100).toFixed(0)}%</span>
              <span className="mono w-20 shrink-0 text-right text-[8px] text-[color:var(--faint)]">μ{s.meanReturn >= 0 ? '+' : ''}{s.meanReturn} σ{s.meanVol}</span>
            </div>
          );
        })}
      </div>

      {/* dynamics */}
      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="EXP. DURATION" value={`${h.expectedDuration.toFixed(0)}d`} color="var(--text)" />
        <Mini label="TRANSITION RISK" value={`${h.transitionRisk.toFixed(0)}%`} color={h.transitionRisk > 25 ? 'var(--gold)' : 'var(--pos)'} />
        <Mini label="NEXT REGIME" value={h.nextRegime ? LABEL_TEXT[h.nextRegime] : '—'} color={h.nextRegime ? LABEL_COLOR[h.nextRegime] : 'var(--dim)'} />
      </div>

      <div className="cell px-2.5 py-1.5">
        {h.reasoning.slice(0, 2).map((r, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[9.5px] leading-snug">
            <span className="mt-px shrink-0" style={{ color: c }}>▸</span>
            <span className="text-[color:var(--dim)]">{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="cell px-2 py-1.5 text-center">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mono mt-0.5 text-[12px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
