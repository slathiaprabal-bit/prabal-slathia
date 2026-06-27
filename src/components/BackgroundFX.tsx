import { motion } from 'motion/react';
import { useTerminal } from '../store';
import { REGIME_THEME } from '../theme';
import type { RegimeState } from '../types';

// Near-black ambient base. A barely-perceptible regime tint only surfaces
// under stress — otherwise the background stays matte black.
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
                     radial-gradient(100% 70% at 50% 110%, rgba(255,255,255,0.012), transparent 60%),
                     #000000`,
      }}
    />
  );
}
