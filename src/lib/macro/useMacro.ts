import { useEffect, useState } from 'react';
import { useTerminal } from '../../store';
import { computeMacro } from './engine';
import { macroValues } from './data';
import type { MacroReading, RegimeScore } from './types';

export interface MacroState {
  readings: MacroReading[];
  regime: RegimeScore;
  byKey: Record<string, MacroReading>;
}

// Drives the macro engine off live engine inputs + the modelled market layer,
// ticking on the same 2s cadence as the snapshot feed.
export function useMacro(): MacroState {
  const vix = useTerminal((s) => s.snap?.vol.vix ?? 0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const values = macroValues(tick * 0.08, { vix });
  const { readings, regime } = computeMacro(values);
  const byKey = Object.fromEntries(readings.map((r) => [r.def.key, r])) as Record<string, MacroReading>;
  return { readings, regime, byKey };
}

export type { MacroReading, RegimeScore } from './types';
