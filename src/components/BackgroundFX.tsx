import { motion } from 'motion/react';
import { useTerminal } from '../store';
import { REGIME_THEME } from '../theme';
import type { RegimeState } from '../types';

// Layered near-black ambience: a soft light falling from the top (like the
// reference's overhead glow), a faint violet undertone, and the regime tint
// that still only surfaces under stress. Data stays the focus.
export function BackgroundFX() {
  const state = (useTerminal((s) => s.snap?.regime.state) ?? 'NORMAL') as RegimeState;
  const th = REGIME_THEME[state];
  const stressed = state === 'VOLATILE' || state === 'NO_GO' || state === 'EVENT_RISK';
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      animate={{ opacity: stressed ? [0.6, 1, 0.6] : 1 }}
      transition={{ duration: stressed ? 2.6 : 1.2, repeat: stressed ? Infinity : 0, ease: 'easeInOut' }}
      style={{
        background: `radial-gradient(130% 90% at 50% -10%, ${th.bgPulse}, transparent 55%),
                     radial-gradient(60% 24% at 50% -6%, rgba(255,255,255,0.05), transparent 70%),
                     radial-gradient(90% 60% at 76% -8%, rgba(124,92,255,0.07), transparent 60%),
                     radial-gradient(70% 55% at 8% 108%, rgba(96,165,250,0.035), transparent 60%),
                     #0a0a0b`,
      }}
    />
  );
}
