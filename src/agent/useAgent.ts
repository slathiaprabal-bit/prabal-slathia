import { useEffect, useMemo, useRef, useState } from 'react';
import { useTerminal } from '../store';
import { contextFromSnapshot } from './provider';
import { research } from './agent';
import { demoContext, SCENARIOS } from './scenarios';
import { loadMemory, recordNote, recordOutcome, allStats, resetMemory, type MemoryStore } from './memory';
import type { ResearchNote, Outcome, SetupStats } from './types';

// ════════════════════════════════════════════════════════════════════════
//  useAgent — binds the research pipeline to VOLARA's live snapshot.
//  When the feed is LIVE, the agent deliberates over real market context and
//  re-writes its note only when the read materially changes (a trader doesn't
//  re-author the note on a 1-tick wiggle). When the feed is DEMO/synthetic the
//  agent would honestly refuse almost everything, so — per the terminal's
//  "never blank in DEMO" rule — it instead rotates through representative
//  scenarios that exercise the full decision range. The latest note is
//  persisted so its outcome can later be resolved, closing the learning loop.
// ════════════════════════════════════════════════════════════════════════

const DEMO_ROTATE_MS = 7000;

export interface AgentView {
  note: ResearchNote | null;
  isDemo: boolean;
  demoLabel: string | null;
  memory: MemoryStore;
  stats: SetupStats[];
  resolve: (noteId: string, outcome: Outcome, r: number | null, comment?: string) => void;
  reset: () => void;
}

export function useAgent(): AgentView {
  const snap = useTerminal((s) => s.snap);
  const [memory, setMemory] = useState<MemoryStore>(() => loadMemory());
  const [demoTick, setDemoTick] = useState(0);
  const lastKeyRef = useRef<string>('');

  // Live when VOLARA streams a real (non-mock) snapshot.
  const isDemo = !snap || snap.source === 'mock' || snap.source === 'demo';

  // Rotate demo scenarios on a gentle cadence so the desk feels alive.
  useEffect(() => {
    if (!isDemo) return;
    const id = window.setInterval(() => setDemoTick((t) => t + 1), DEMO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [isDemo]);

  const note = useMemo<ResearchNote | null>(() => {
    const ctx = isDemo ? demoContext(demoTick) : contextFromSnapshot(snap!);
    return research(ctx, memory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, isDemo, demoTick, memory.records.length]);

  const demoLabel = isDemo ? SCENARIOS[((demoTick % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length].name : null;

  // Persist a note when the deliberation materially changes (regime/structure/
  // verdict/grade), keeping the recent-notes history meaningful, not noisy.
  useEffect(() => {
    if (!note) return;
    const key = `${note.setupKey}|${note.verdict}|${note.conviction.grade}`;
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      setMemory(recordNote(note));
    }
  }, [note]);

  const stats = useMemo(() => allStats(memory), [memory]);

  return {
    note,
    isDemo,
    demoLabel,
    memory,
    stats,
    resolve: (id, outcome, r, comment) => setMemory(recordOutcome(id, outcome, r, comment)),
    reset: () => setMemory(resetMemory()),
  };
}
