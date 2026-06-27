import { motion } from 'motion/react';
import { useTerminal } from '../../store';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import type { Greeks } from '../../types';

interface Spec {
  key: keyof Greeks;
  label: string;
  dp: number;
  // soft risk scale: |value| beyond `hot` reads as elevated risk
  hot: number;
}

const SPECS: Spec[] = [
  { key: 'delta', label: 'Δ Delta', dp: 2, hot: 8 },
  { key: 'gamma', label: 'Γ Gamma', dp: 4, hot: 0.02 },
  { key: 'theta', label: 'Θ Theta', dp: 0, hot: 400 },
  { key: 'vega', label: 'ν Vega', dp: 0, hot: 400 },
  { key: 'charm', label: 'Charm', dp: 3, hot: 0.3 },
  { key: 'vanna', label: 'Vanna', dp: 3, hot: 0.4 },
  { key: 'vomma', label: 'Vomma', dp: 2, hot: 10 },
  { key: 'speed', label: 'Speed', dp: 4, hot: 0.01 },
];

function riskColor(v: number, hot: number): string {
  const m = Math.min(1, Math.abs(v) / hot);
  if (m < 0.4) return '#27d17c';
  if (m < 0.75) return '#f4b740';
  return '#f04668';
}

export function GreeksPanel() {
  const g = useTerminal((s) => s.snap?.greeks);
  if (!g) return null;
  return (
    <div className="grid h-full grid-cols-2 gap-2 content-start">
      {SPECS.map((s, i) => {
        const v = g[s.key];
        const color = riskColor(v, s.hot);
        const mag = Math.min(1, Math.abs(v) / s.hot);
        return (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="relative overflow-hidden cell px-2.5 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-wide text-[color:var(--dim)]">{s.label}</span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            </div>
            <AnimatedNumber
              value={v}
              format={(x) => (Math.abs(x) >= 1000 ? (x / 1000).toFixed(1) + 'k' : x.toFixed(s.dp))}
              className="mt-0.5 block text-lg font-semibold"
            />
            <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${mag * 100}%` }}
                transition={{ duration: 0.5 }}
                style={{ background: color }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
