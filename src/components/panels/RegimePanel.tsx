import { motion, AnimatePresence } from 'motion/react';
import { useTerminal } from '../../store';
import { REGIME_THEME } from '../../theme';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { signed } from '../../lib/format';

export function RegimePanel() {
  const reg = useTerminal((s) => s.snap?.regime);
  if (!reg) return null;
  const th = REGIME_THEME[reg.state];

  return (
    <div className="relative flex h-full flex-col justify-between">
      {/* pulsing aura */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        animate={{ opacity: [0.25, 0.6, 0.25] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: `radial-gradient(80% 60% at 50% 0%, ${th.glow}, transparent 70%)` }}
      />
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={reg.state}
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.45 }}
            className="text-[1.7rem] font-extrabold leading-none tracking-tight"
            style={{ color: th.accent }}
          >
            {th.label}
          </motion.div>
        </AnimatePresence>
        <div className="mt-1 text-xs text-[color:var(--dim)]">{reg.engineRegime.replace(/_/g, ' ')}</div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2">
        <Stat label="CONFIDENCE" value={<AnimatedNumber value={reg.confidence} format={(v) => `${v.toFixed(0)}%`} />} accent={th.accent} />
        <Stat label="VIX" value={<AnimatedNumber value={reg.vix} format={(v) => v.toFixed(1)} />} accent={th.accent} />
        <Stat label="VIX Δ" value={<AnimatedNumber value={reg.vixChg} format={(v) => signed(v, 1) + '%'} />} accent={th.accent} />
      </div>

      <div className="relative mt-3 text-[11px] leading-snug text-[color:var(--dim)]">{reg.note}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="mono text-base font-semibold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
