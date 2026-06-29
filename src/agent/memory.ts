import type { OutcomeRecord, SetupStats, Outcome, ResearchNote, Verdict } from './types';
import { clamp } from './types';

// ════════════════════════════════════════════════════════════════════════
//  MEMORY & LEARNING
//  "Continuously learn from previous market behaviour." Every research note is
//  logged; when its outcome resolves, the agent updates a per-SETUP track
//  record. Setup statistics are Beta-smoothed so a 2-trade sample never
//  masquerades as an edge, and discounted by sample confidence. The conviction
//  step reads these priors and nudges itself toward what has actually worked —
//  a closed feedback loop, not a static model.
//
//  Storage is an injectable interface. The default is browser localStorage so
//  the loop is real and demonstrable today; swap in a VOLARA/SQLite-backed
//  store later without touching the reasoning engine.
// ════════════════════════════════════════════════════════════════════════

const KEY = 'volara.agent.memory.v1';
const PRIOR_STRENGTH = 4;   // Beta pseudo-counts: humility on small samples
const CONF_HALFLIFE = 8;    // trades at which the prior is ~50% trusted

export interface MemoryStore {
  records: OutcomeRecord[];
  notes: ResearchNote[];     // ring buffer of recent notes (most-recent first)
}

interface Persist {
  load: () => MemoryStore;
  save: (m: MemoryStore) => void;
}

// ── Persistence adapter (localStorage by default; safe in non-browser ctx) ──
const browserPersist: Persist = {
  load: () => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as MemoryStore;
    } catch { /* ignore */ }
    return seed();
  },
  save: (m) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(m));
    } catch { /* ignore */ }
  },
};

let persist: Persist = browserPersist;
export function setPersist(p: Persist) { persist = p; }

// ── Public API ────────────────────────────────────────────────────────────

export function loadMemory(): MemoryStore {
  return persist.load();
}

// Append a freshly-generated note (keeps a bounded recent history).
export function recordNote(note: ResearchNote): MemoryStore {
  const m = persist.load();
  m.notes = [note, ...m.notes.filter((n) => n.id !== note.id)].slice(0, 50);
  persist.save(m);
  return m;
}

// Resolve a note's outcome — this is the learning event.
export function recordOutcome(
  noteId: string, outcome: Outcome, rMultiple: number | null, note?: string,
): MemoryStore {
  const m = persist.load();
  const src = m.notes.find((n) => n.id === noteId);
  const rec: OutcomeRecord = {
    noteId,
    ts: new Date().toISOString(),
    setupKey: src?.setupKey ?? 'unknown',
    verdict: src?.verdict ?? 'STAND_ASIDE',
    conviction: src?.conviction.final ?? 0,
    outcome,
    rMultiple,
    note,
  };
  m.records = [rec, ...m.records.filter((r) => r.noteId !== noteId)].slice(0, 500);
  persist.save(m);
  return m;
}

// Compute the learned statistics for one setup key from resolved outcomes.
export function statsFor(setupKey: string, m: MemoryStore = persist.load()): SetupStats {
  const resolved = m.records.filter((r) => r.setupKey === setupKey && r.outcome !== 'PENDING');
  const n = resolved.length;
  const wins = resolved.filter((r) => r.outcome === 'WIN').length;
  const losses = resolved.filter((r) => r.outcome === 'LOSS').length;

  // Beta-smoothed hit-rate around a 0.5 prior.
  const hitRate = (wins + PRIOR_STRENGTH * 0.5) / (n + PRIOR_STRENGTH);
  const rs = resolved.map((r) => r.rMultiple).filter((x): x is number => x !== null);
  const avgR = rs.length ? rs.reduce((s, x) => s + x, 0) / rs.length : 0;

  // Confidence grows with sample size; edge is the smoothed hit-rate minus a
  // 0.5 baseline, discounted by how much we trust the sample.
  const confidence = clamp(n / (n + CONF_HALFLIFE), 0, 1);
  const edge = clamp((hitRate - 0.5) * 2 * confidence + clamp(avgR / 2, -0.3, 0.3) * confidence, -1, 1);

  return { setupKey, n, wins, losses, hitRate, avgR, edge, confidence };
}

// All setup track records, busiest first — for the memory panel.
export function allStats(m: MemoryStore = persist.load()): SetupStats[] {
  const keys = Array.from(new Set(m.records.map((r) => r.setupKey)));
  return keys.map((k) => statsFor(k, m)).sort((a, b) => b.n - a.n);
}

// ── Seeded baseline ────────────────────────────────────────────────────────
// A small, clearly-labelled starter track record so the learning loop is
// populated on first run. These are illustrative priors, not real fills, and
// are overwritten as live outcomes accumulate.
function seed(): MemoryStore {
  const mk = (setupKey: string, outcome: Outcome, r: number, daysAgo: number): OutcomeRecord => ({
    noteId: `seed-${setupKey}-${daysAgo}-${outcome}`,
    ts: new Date(Date.now() - daysAgo * 864e5).toISOString(),
    setupKey,
    verdict: 'ENGAGE' as Verdict,
    conviction: 70,
    outcome,
    rMultiple: r,
    note: 'seeded baseline',
  });
  const records: OutcomeRecord[] = [
    // RANGE premium-selling: the historical bread-and-butter — solid edge.
    mk('RANGE|PREMIUM_SELLING|NEUTRAL', 'WIN', 0.8, 3),
    mk('RANGE|PREMIUM_SELLING|NEUTRAL', 'WIN', 0.9, 6),
    mk('RANGE|PREMIUM_SELLING|NEUTRAL', 'LOSS', -1.4, 9),
    mk('RANGE|PREMIUM_SELLING|NEUTRAL', 'WIN', 0.7, 12),
    mk('RANGE|PREMIUM_SELLING|NEUTRAL', 'WIN', 0.85, 15),
    // TREND directional longs: fewer, higher payoff, lower hit-rate.
    mk('TREND|DIRECTIONAL|LONG', 'WIN', 2.6, 4),
    mk('TREND|DIRECTIONAL|LONG', 'LOSS', -1.0, 7),
    mk('TREND|DIRECTIONAL|LONG', 'WIN', 1.8, 11),
    // VOLATILE_EXPANSION long-vol: choppy, near break-even — the agent should
    // learn to keep these small.
    mk('VOLATILE_EXPANSION|LONG_VOL|NEUTRAL', 'LOSS', -1.0, 5),
    mk('VOLATILE_EXPANSION|LONG_VOL|NEUTRAL', 'WIN', 1.2, 8),
    mk('VOLATILE_EXPANSION|LONG_VOL|NEUTRAL', 'LOSS', -1.0, 13),
  ];
  return { records, notes: [] };
}

export function resetMemory(): MemoryStore {
  const m = seed();
  persist.save(m);
  return m;
}
