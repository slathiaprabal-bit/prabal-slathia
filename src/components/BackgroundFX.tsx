import { motion } from 'motion/react';
import { useTerminal } from '../store';
import { REGIME_THEME } from '../theme';
import type { RegimeState } from '../types';

// Full-screen ambient tint that shifts with the regime and pulses in stress.
export function BackgroundFX() {
  const state = (useTerminal((s) => s.snap?.regime.state) ?? 'NORMAL') as RegimeState;
  const th = REGIME_THEME[state];
  const stressed = state === 'VOLATILE' || state === 'NO_GO' || state === 'EVENT_RISK';
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      animate={{ opacity: stressed ? [0.5, 0.85, 0.5] : 0.5 }}
      transition={{ duration: stressed ? 2.2 : 1.2, repeat: stressed ? Infinity : 0, ease: 'easeInOut' }}
      style={{
        background: `radial-gradient(120% 80% at 50% -10%, ${th.bgPulse}, transparent 60%),
                     radial-gradient(80% 60% at 80% 100%, ${th.glow.replace('0.5', '0.06').replace('0.55', '0.06').replace('0.6', '0.06')}, transparent 70%)`,
      }}
    />
  );
}
