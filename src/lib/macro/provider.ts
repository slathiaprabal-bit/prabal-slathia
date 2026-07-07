// Macro data provider (frontend). Fetches the backend /api/macro payload and
// maps it to the provenance contract. This replaces the old fabricated
// oscillator — the UI now shows only real data, official figures, or an
// explicit NO_LIVE_DATA state. Swapping the upstream data feed is a backend
// one-file change; the frontend always reads this same shape.
import type { MacroProvenance, MacroEvent } from './types';

const API_BASE =
  (import.meta as any).env?.VITE_API_URL ||
  `http://${location.hostname}:8000`;

export interface MacroPayload {
  generatedAt: string;
  metrics: Record<string, MacroProvenance>;
  events: MacroEvent[];
}

export async function fetchMacro(): Promise<MacroPayload | null> {
  try {
    const res = await fetch(`${API_BASE}/api/macro`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const raw = await res.json();
    const metrics: Record<string, MacroProvenance> = {};
    for (const [k, m] of Object.entries(raw.metrics ?? {})) {
      const mm = m as any;
      metrics[k] = {
        value: mm.value ?? null,
        previous: mm.previous ?? null,
        timestamp: mm.timestamp ?? null,
        freshness: mm.freshness ?? null,
        source: mm.source ?? '',
        confidence: mm.confidence ?? 0,
        status: (mm.status ?? 'NO_LIVE_DATA') as MacroProvenance['status'],
        asof: mm.asof ?? null,
        nextRelease: mm.next_release ?? null,
      };
    }
    return { generatedAt: raw.generatedAt ?? '', metrics, events: raw.events ?? [] };
  } catch {
    return null; // never fabricate on failure — caller renders NO_LIVE_DATA
  }
}
