import { motion } from 'motion/react';
import type { RankedStrategy, Bias, Vega, RiskTier } from '../../lib/ranking/types';

const BIAS_COLOR: Record<Bias, string> = { BULL: 'var(--pos)', NEUTRAL: 'var(--gold)', BEAR: 'var(--neg)' };
const VEGA_COLOR: Record<Vega, string> = { SHORT: 'var(--pos)', LONG: 'var(--info)', NEUTRAL: 'var(--gold)' };
const RISK_COLOR: Record<RiskTier, string> = { LOW: 'var(--pos)', MEDIUM: 'var(--gold)', HIGH: 'var(--neg)' };

// Presentation-only — decision-driven strategy ranking (Decision Engine → here).
export function StrategyRanking({ items }: { items: RankedStrategy[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-auto">
      {items.map((s, i) => {
        const sc = s.score >= 75 ? 'var(--pos)' : s.score >= 55 ? 'var(--gold)' : 'var(--dim)';
        return (
          <motion.div key={s.key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
            className="cell px-3 py-2" style={s.recommended ? { borderColor: 'rgba(244,183,64,0.35)' } : undefined}>
            <div className="flex items-center gap-2">
              <span className="mono w-4 shrink-0 text-[11px] font-bold text-[color:var(--dim)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-bold text-[color:var(--text)]">{s.name}</span>
                  {s.recommended && <span className="rounded-[3px] bg-[color:var(--gold)]/15 px-1 py-px text-[7px] font-bold tracking-wider text-[color:var(--gold)]">PICK</span>}
                </div>
                <div className="text-[8px] text-[color:var(--faint)]">{s.family}</div>
              </div>
              <span className="mono text-[14px] font-bold" style={{ color: sc }}>{s.score}</span>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              <Tag label={s.bias} color={BIAS_COLOR[s.bias]} />
              <Tag label={`${s.vega}-ν`} color={VEGA_COLOR[s.vega]} />
              <Tag label={s.risk} color={RISK_COLOR[s.risk]} />
              <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: sc }} />
              </div>
            </div>

            {s.reasons[0] && <div className="mt-1 truncate text-[9.5px] text-[color:var(--dim)]">▸ {s.reasons[0]}</div>}
          </motion.div>
        );
      })}
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span className="rounded-[3px] px-1.5 py-px text-[8px] font-bold tracking-wider" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{label}</span>
  );
}
