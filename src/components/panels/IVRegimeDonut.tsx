import { motion } from 'motion/react';
import { useTerminal } from '../../store';
import { REGIME_THEME } from '../../theme';

// Circular regime-strength gauge with trend / volatility / momentum readouts.
export function IVRegimeDonut() {
  const reg = useTerminal((s) => s.snap?.regime);
  if (!reg) return null;
  const th = REGIME_THEME[reg.state];
  const strength = Math.max(0, Math.min(100, reg.confidence));

  const size = 130;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;

  const vix = reg.vix ?? 0;
  const volTag = vix >= 20 ? 'HIGH' : vix >= 13 ? 'MODERATE' : 'LOW';
  const trendTag = reg.state === 'TRENDING_UP' ? 'UP' : reg.state === 'TRENDING_DOWN' || reg.state === 'NO_GO' ? 'DOWN' : 'FLAT';
  const trendColor = trendTag === 'UP' ? 'var(--pos)' : trendTag === 'DOWN' ? 'var(--neg)' : 'var(--gold)';
  const mom = Math.abs(reg.trendAtr ?? 0);
  const momTag = mom >= 1.2 ? 'STRONG' : mom >= 0.6 ? 'MODERATE' : 'WEAK';

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={th.accent} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: c * (1 - strength / 100) }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[12px] font-bold tracking-tight" style={{ color: th.accent }}>{th.label}</div>
          <div className="eyebrow mt-0.5 text-[7px]">STRENGTH</div>
          <div className="mono text-2xl font-extrabold text-white">{strength.toFixed(0)}%</div>
        </div>
      </div>

      <div className="mt-3 grid w-full grid-cols-3 gap-1.5">
        <Mini label="TREND" value={trendTag} color={trendColor} />
        <Mini label="VOLATILITY" value={volTag} color={vix >= 20 ? 'var(--neg)' : vix >= 13 ? 'var(--gold)' : 'var(--pos)'} />
        <Mini label="MOMENTUM" value={momTag} color={momTag === 'STRONG' ? 'var(--pos)' : momTag === 'WEAK' ? 'var(--dim)' : 'var(--gold)'} />
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="cell px-1.5 py-1.5 text-center">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mt-0.5 text-[11px] font-bold tracking-tight" style={{ color }}>{value}</div>
    </div>
  );
}
