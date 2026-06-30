import { useEffect, useState } from 'react';
import { useTerminal } from '../../store';
import { computeMacro } from './engine';
import { fetchMacro } from './provider';
import type { MacroReading, MacroProvenance, MacroEvent, RegimeScore } from './types';

export interface MacroState {
  readings: MacroReading[];
  regime: RegimeScore;
  byKey: Record<string, MacroReading>;
  events: MacroEvent[];
  generatedAt: string | null; // when the backend built the payload
  loading: boolean;           // before the first successful fetch
}

// Drives the macro engine off the live backend /api/macro feed (provenance-rich,
// no fabrication), polled every 30s, with India VIX overlaid live from the
// quant-engine snapshot. The interpretation/regime layer is deterministic.
export function useMacro(): MacroState {
  const vix = useTerminal((s) => s.snap?.vol.vix ?? null);
  const prevVix = useTerminal((s) => s.prev?.vol.vix ?? null);

  const [metrics, setMetrics] = useState<Record<string, MacroProvenance>>({});
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const data = await fetchMacro();
      if (!alive) return;
      if (data) {
        setMetrics(data.metrics);
        setEvents(data.events);
        setGeneratedAt(data.generatedAt);
      }
      setLoading(false);
    };
    load();
    const id = window.setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Overlay India VIX live from the real-time engine snapshot (status LIVE).
  const merged: Record<string, MacroProvenance> = { ...metrics };
  if (vix != null) {
    merged.vix = {
      value: vix,
      previous: prevVix,
      timestamp: new Date().toISOString(),
      freshness: 0,
      source: 'Quant Engine · India VIX',
      confidence: 0.9,
      status: 'LIVE',
    };
  }

  const { readings, regime } = computeMacro(merged);
  const byKey = Object.fromEntries(readings.map((r) => [r.def.key, r])) as Record<string, MacroReading>;
  return { readings, regime, byKey, events, generatedAt, loading };
}

export type { MacroReading, RegimeScore } from './types';
