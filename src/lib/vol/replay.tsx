// Session Replay — scoped to the Volatility Terminal only.
//
// Polls the backend intraday replay buffer, classifies each recorded moment
// into a volatility-cycle phase (via the SAME deterministic engine that powers
// the live panel), and exposes a context that lets the terminal's vol panels
// render AT a selected past moment. Decision/ranking engines elsewhere keep
// reading the LIVE snapshot — replay never leaks outside this workspace.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTerminal } from '../../store';
import { buildVolInputs } from './inputs';
import { computeVolState } from './engine';
import type { ReplaySample, Snapshot } from '../../types';
import type { VolState } from './types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || `http://${location.hostname}:8000`;

export type CyclePhase = 'COMPRESSION' | 'NEUTRAL' | 'EXPANSION';

export interface ReplayMoment {
  sample: ReplaySample;
  phase: CyclePhase;
  score: number;
}

interface ReplayState {
  moments: ReplayMoment[];
  cycle: Record<CyclePhase, number>;   // session share, 0..1
  activeTs: string | null;
  setActiveTs: (ts: string | null) => void;
}

const Ctx = createContext<ReplayState>({ moments: [], cycle: { COMPRESSION: 0, NEUTRAL: 0, EXPANSION: 0 }, activeTs: null, setActiveTs: () => {} });

// Pseudo-snapshot: a replay sample grafted onto the live snapshot so the pure
// input derivation (buildVolInputs) works unchanged for past moments.
export function sampleAsSnap(live: Snapshot, s: ReplaySample): Snapshot {
  return {
    ...live,
    spot: s.spot,
    vol: { ...live.vol, ...s.vol },
    regime: { ...live.regime, vixChg: s.vixChg },
    smile: s.smile,
    term: s.term,
    surface: s.surface,
  };
}

export function classify(live: Snapshot, s: ReplaySample): { phase: CyclePhase; score: number; state: VolState } {
  const state = computeVolState(buildVolInputs(sampleAsSnap(live, s)));
  const phase: CyclePhase = state.expansionProb >= 57 ? 'EXPANSION'
    : state.compressionProb >= 57 ? 'COMPRESSION' : 'NEUTRAL';
  return { phase, score: state.score, state };
}

export function VolReplayProvider({ children }: { children: ReactNode }) {
  const snap = useTerminal((st) => st.snap);
  const [samples, setSamples] = useState<ReplaySample[]>([]);
  const [activeTs, setActiveTs] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/vol-replay`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const d = await res.json();
        if (alive && Array.isArray(d.samples)) setSamples(d.samples);
      } catch { /* buffer unavailable — panel shows its empty state */ }
    };
    load();
    const id = window.setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const value = useMemo<ReplayState>(() => {
    if (!snap) return { moments: [], cycle: { COMPRESSION: 0, NEUTRAL: 0, EXPANSION: 0 }, activeTs, setActiveTs };
    const moments = samples.map((s) => {
      const { phase, score } = classify(snap, s);
      return { sample: s, phase, score };
    });
    const n = moments.length || 1;
    const cycle = {
      COMPRESSION: moments.filter((m) => m.phase === 'COMPRESSION').length / n,
      NEUTRAL: moments.filter((m) => m.phase === 'NEUTRAL').length / n,
      EXPANSION: moments.filter((m) => m.phase === 'EXPANSION').length / n,
    };
    return { moments, cycle, activeTs, setActiveTs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, snap, activeTs]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReplay(): ReplayState {
  return useContext(Ctx);
}

// The snapshot the Volatility Terminal panels should render: the live snap, or
// the selected replay moment grafted onto it.
export function useVolSnap(): { snap: Snapshot | null; replayingAt: string | null } {
  const live = useTerminal((st) => st.snap);
  const { moments, activeTs } = useReplay();
  return useMemo(() => {
    if (!live || !activeTs) return { snap: live ?? null, replayingAt: null };
    const m = moments.find((x) => x.sample.ts === activeTs);
    if (!m) return { snap: live, replayingAt: null };
    return { snap: sampleAsSnap(live, m.sample), replayingAt: m.sample.t };
  }, [live, moments, activeTs]);
}

// Replay-aware VolState for the engine panel (falls back to live).
export function useVolState(): VolState | null {
  const { snap } = useVolSnap();
  return useMemo(() => (snap ? computeVolState(buildVolInputs(snap)) : null), [snap]);
}
