import { motion } from 'motion/react';
import type { DecisionOutput, Direction, VolRegime } from '../../lib/decision/types';

const DIR_COLOR: Record<Direction, string> = {
  BULLISH: 'var(--pos)', NEUTRAL: 'var(--gold)', BEARISH: 'var(--neg)',
};
const VOL_COLOR: Record<VolRegime, string> = {
  VERY_LOW: 'var(--info)', LOW: 'var(--info)', NORMAL: 'var(--pos)',
  ELEVATED: 'var(--gold)', HIGH: 'var(--neg)', EXTREME: 'var(--neg)',
};

// Top-level verdict: directional bias + confidence + the three decision metrics.
export function DecisionVerdict({ d }: { d: DecisionOutput }) {
  const color = DIR_COLOR[d.direction];
  const pos = (d.directionalScore + 100) / 2;

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow text-[8px]">DIRECTIONAL BIAS</div>
            <motion.div key={d.direction} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="text-[26px] font-extrabold leading-none tracking-tight" style={{ color }}>
              {d.direction}
            </motion.div>
          </div>
          <div className="text-right">
            <div className="eyebrow text-[8px]">CONFIDENCE</div>
            <div className="mono text-2xl font-bold" style={{ color }}>{d.confidence.toFixed(0)}<span className="text-sm">%</span></div>
          </div>
        </div>

        {/* directional meter */}
        <div className="mt-2.5 relative h-2 overflow-hidden rounded-full"
          style={{ background: 'linear-gradient(90deg, color-mix(in srgb,var(--neg) 55%,transparent), rgba(255,255,255,.06) 50%, color-mix(in srgb,var(--pos) 55%,transparent))' }}>
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
          <motion.div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full"
            style={{ background: color, boxShadow: '0 0 0 2px var(--bg0)' }}
            animate={{ left: `calc(${pos}% - 2px)` }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
        </div>
        <div className="mt-1 flex justify-between text-[8px] tracking-wider text-[color:var(--dim)]">
          <span>BEARISH</span><span>NEUTRAL</span><span>BULLISH</span>
        </div>
      </div>

      {/* three decision metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="TREND STRENGTH" value={`${d.trendStrength.toFixed(0)}`} suffix="/100" bar={d.trendStrength} color="var(--info)" />
        <div className="cell flex flex-col justify-center px-2.5 py-2">
          <div className="eyebrow text-[8px]">VOL REGIME</div>
          <div className="mt-1 text-[15px] font-bold" style={{ color: VOL_COLOR[d.volRegime] }}>{d.volRegime.replace('_', ' ')}</div>
        </div>
        <Metric label="SELL SUITABILITY" value={`${d.sellingSuitability.toFixed(0)}`} suffix="/100" bar={d.sellingSuitability}
          color={d.sellingSuitability >= 55 ? 'var(--pos)' : d.sellingSuitability <= 40 ? 'var(--neg)' : 'var(--gold)'} />
      </div>
    </div>
  );
}

function Metric({ label, value, suffix, bar, color }: { label: string; value: string; suffix?: string; bar: number; color: string }) {
  return (
    <div className="cell flex flex-col justify-center px-2.5 py-2">
      <div className="eyebrow text-[8px]">{label}</div>
      <div className="mono mt-1 text-[15px] font-bold" style={{ color }}>
        {value}<span className="text-[9px] text-[color:var(--dim)]">{suffix}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${bar}%`, background: color }} />
      </div>
    </div>
  );
}
