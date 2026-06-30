// Market Events provider (frontend). Fetches the backend /api/events payload.
// Swapping the upstream calendar feed is a backend one-file change; the frontend
// always reads this same shape.
import type { RawEvent } from './types';

const API_BASE =
  (import.meta as any).env?.VITE_API_URL ||
  `http://${location.hostname}:8000`;

export async function fetchEvents(): Promise<RawEvent[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/events`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const raw = await res.json();
    return (raw.events ?? []) as RawEvent[];
  } catch {
    return null; // never fabricate — caller shows an empty/last-good state
  }
}
