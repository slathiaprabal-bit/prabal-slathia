import { motion } from 'motion/react';
import { useTerminal } from '../../store';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { signed } from '../../lib/format';

function MetricRow({
  label,
  value,
  sub,
  color,
  bar,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  bar?: number; // 0–100 fill
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-[9px]">{label}</span>
        <span className="mono text-sm font-semibold" style={{ color: color ?? 'var(--text)' }}>
          {value}
        </span>
      </div>
      {bar !== undefined && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color ?? '#3fd6f5', width: `${Math.min(100, bar)}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, bar)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}
      {sub && <div className="text-[10px] text-[color:var(--dim)]">{sub}</div>}
    </div>
  );
}

export function VolMetricsPanel() {
  const vol = useTerminal((s) => s.snap?.vol);
  const pos = useTerminal((s) => s.snap?.positioning);
  const risk = useTerminal((s) => s.snap?.risk);
  const spot = useTerminal((s) => s.snap?.spot);

  if (!vol) return null;

  const ivrColor =
    (vol.ivRank ?? 0) >= 70 ? '#ff2d6e'
    : (vol.ivRank ?? 0) >= 50 ? '#ffb020'
    : '#16f5b0';

  const vrp = vol.vrp ?? 0;
  const vrpColor = vrp > 0 ? '#16f5b0' : '#ff2d6e';

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      {/* IV metrics */}
      <div className="rounded-[6px] border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-2.5">
        <div className="eyebrow text-[9px] mb-0.5">VOLATILITY METRICS</div>

        <MetricRow
          label="IV RANK"
          value={<AnimatedNumber value={vol.ivRank ?? 0} format={(v) => `${v.toFixed(0)}`} />}
          color={ivrColor}
          bar={vol.ivRank ?? 0}
        />
        <MetricRow
          label="IV PERCENTILE"
          value={<AnimatedNumber value={vol.ivPctile ?? 0} format={(v) => `${v.toFixed(0)}`} />}
          color="#c084fc"
          bar={vol.ivPctile ?? 0}
        />
        <MetricRow
          label="INDIA VIX"
          value={<AnimatedNumber value={vol.vix} format={(v) => v.toFixed(2)} />}
          color="#ffb020"
        />
        <MetricRow
          label="HV20"
          value={<AnimatedNumber value={vol.hv20 ?? 0} format={(v) => v.toFixed(1)} />}
          color="var(--dim)"
        />
        <MetricRow
          label="VOL RISK PREMIUM"
          value={<AnimatedNumber value={vrp} format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`} />}
          color={vrpColor}
          sub={vrp > 0 ? 'IV overpriced — sell vol edge' : 'IV cheap — buy vol edge'}
        />
      </div>

      {/* Expected move */}
      <div className="rounded-[6px] border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-2.5">
        <div className="eyebrow text-[9px] mb-0.5">EXPECTED MOVE</div>
        <MetricRow
          label="EM (EXPIRY) ±"
          value={<AnimatedNumber value={vol.emExpiry} format={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} />}
          color="#3fd6f5"
        />
        <MetricRow
          label="EM (1 DAY) ±"
          value={<AnimatedNumber value={vol.em1d} format={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })} />}
          color="#3fd6f5"
        />
        <MetricRow
          label="P(INSIDE 1σ)"
          value={<AnimatedNumber value={(vol.pInside1 ?? 0) * 100} format={(v) => `${v.toFixed(0)}%`} />}
          color="#16f5b0"
          bar={(vol.pInside1 ?? 0) * 100}
        />
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {[
            { l: '1σ LO', v: vol.sigma1?.[0] },
            { l: '1σ HI', v: vol.sigma1?.[1] },
            { l: '2σ LO', v: vol.sigma2?.[0] },
            { l: '2σ HI', v: vol.sigma2?.[1] },
          ].map(({ l, v }) => (
            <div key={l} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
              <div className="eyebrow text-[8px]">{l}</div>
              <div className="mono text-xs font-semibold text-white">
                {v != null ? v.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Positioning */}
      {pos && (
        <div className="rounded-[6px] border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-2.5">
          <div className="eyebrow text-[9px] mb-0.5">POSITIONING</div>
          <MetricRow
            label="PCR (OI)"
            value={<AnimatedNumber value={pos.pcr} format={(v) => v.toFixed(2)} />}
            color={pos.pcr > 1 ? '#16f5b0' : '#ff7a8a'}
            sub={pos.pcr > 1.1 ? 'Bullish skew' : pos.pcr < 0.9 ? 'Bearish skew' : 'Neutral'}
          />
          <MetricRow
            label="MAX PAIN"
            value={pos.maxPain?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) ?? '—'}
            color="#c084fc"
            sub={spot ? `Δ ${(pos.maxPain - spot).toLocaleString('en-IN', { maximumFractionDigits: 0, signDisplay: 'always' })}` : undefined}
          />
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <div className="rounded-lg bg-[#16f5b0]/5 border border-[#16f5b0]/10 px-2 py-1.5">
              <div className="eyebrow text-[8px] text-[#16f5b0]">SUPPORT</div>
              <div className="mono text-xs font-semibold text-[#16f5b0]">
                {pos.support?.[0]?.toLocaleString('en-IN') ?? '—'}
              </div>
            </div>
            <div className="rounded-lg bg-[#ff2d6e]/5 border border-[#ff2d6e]/10 px-2 py-1.5">
              <div className="eyebrow text-[8px] text-[#ff7a8a]">RESISTANCE</div>
              <div className="mono text-xs font-semibold text-[#ff7a8a]">
                {pos.resistance?.[0]?.toLocaleString('en-IN') ?? '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk */}
      {risk && (
        <div className="rounded-[6px] border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-2">
          <div className="eyebrow text-[9px] mb-0.5">RISK METRICS</div>
          <MetricRow
            label="PORTFOLIO HEAT"
            value={<AnimatedNumber value={(risk.portfolioHeat ?? 0) * 100} format={(v) => `${v.toFixed(1)}%`} />}
            color={(risk.portfolioHeat ?? 0) > 0.03 ? '#ffb020' : '#16f5b0'}
            bar={(risk.portfolioHeat ?? 0) * 100 * 3}
          />
          <MetricRow
            label="MARGIN USAGE"
            value={<AnimatedNumber value={(risk.marginUsage ?? 0) * 100} format={(v) => `${v.toFixed(1)}%`} />}
            color={(risk.marginUsage ?? 0) > 0.35 ? '#ff2d6e' : '#3fd6f5'}
            bar={(risk.marginUsage ?? 0) * 100}
          />
          {risk.probRuin != null && (
            <MetricRow
              label="P(RUIN)"
              value={<AnimatedNumber value={(risk.probRuin) * 100} format={(v) => `${v.toFixed(1)}%`} />}
              color={risk.probRuin > 0.02 ? '#ff2d6e' : '#16f5b0'}
            />
          )}
        </div>
      )}
    </div>
  );
}
