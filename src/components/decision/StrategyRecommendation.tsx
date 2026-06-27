import { motion } from 'motion/react';
import type { DecisionOutput } from '../../lib/decision/types';

// Recommended structure + reasoning + top contributing factors.
export function StrategyRecommendation({ d }: { d: DecisionOutput }) {
  return (
    <div className="flex h-full flex-col gap-3">
      {/* Recommendation */}
      <div className="cell px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[8px]">RECOMMENDED STRUCTURE</span>
          <span className="rounded-[4px] px-1.5 py-px text-[8px] font-bold tracking-wider text-[color:var(--gold)]"
            style={{ background: 'color-mix(in srgb, var(--gold) 12%, transparent)' }}>
            {d.strategy.family}
          </span>
        </div>
        <motion.div key={d.strategy.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          className="mt-1 text-lg font-extrabold tracking-tight text-white">
          {d.strategy.name}
        </motion.div>
        <p className="mt-1 text-[11px] leading-snug text-[color:var(--dim)]">{d.strategy.rationale}</p>
      </div>

      {/* Reasons */}
      <div className="min-h-0 flex-1">
        <div className="eyebrow mb-1.5 text-[8px]">DECISION RATIONALE</div>
        <div className="flex flex-col gap-1.5">
          {d.reasons.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-start gap-1.5 text-[11px] leading-snug">
              <span className="mt-px text-[color:var(--gold)]">▸</span>
              <span className="text-[color:var(--text)]/85">{r}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Top factors */}
      <div>
        <div className="eyebrow mb-1.5 text-[8px]">TOP CONTRIBUTING FACTORS</div>
        <div className="grid grid-cols-2 gap-1.5">
          {d.factors.map((f) => {
            const color = f.bias > 0.1 ? 'var(--pos)' : f.bias < -0.1 ? 'var(--neg)' : 'var(--gold)';
            return (
              <div key={f.label} className="cell flex items-center justify-between px-2.5 py-1.5">
                <span className="text-[10px] text-[color:var(--dim)]">{f.label}</span>
                <span className="mono text-[11px] font-semibold" style={{ color }}>
                  {f.bias > 0 ? '+' : ''}{(f.bias * 100).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
