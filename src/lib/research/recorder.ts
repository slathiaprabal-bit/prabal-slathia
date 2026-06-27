import type { ResearchRow } from './features';
import { NUMERIC_FEATURES } from './features';

const STORE_KEY = 'volara.research.v1';
const CAP = 1000;

// In-session research recorder: a capped ring buffer persisted to localStorage,
// matching sql/research_schema.sql. Export → load into the SQL schema for ML
// training. (A networked deployment would POST rows to a server-side DB.)
class ResearchRecorder {
  private rows: ResearchRow[] = [];
  private lastTs = '';

  constructor() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORE_KEY);
      if (raw) this.rows = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  // Records at most one row per distinct snapshot timestamp.
  record(row: ResearchRow): boolean {
    if (!row.ts || row.ts === this.lastTs) return false;
    this.lastTs = row.ts;
    this.rows.push(row);
    if (this.rows.length > CAP) this.rows.splice(0, this.rows.length - CAP);
    this.persist();
    return true;
  }

  private persist() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, JSON.stringify(this.rows)); } catch { /* ignore */ }
  }

  all(): ResearchRow[] { return this.rows; }
  count(): number { return this.rows.length; }
  clear() { this.rows = []; this.lastTs = ''; this.persist(); }

  exportJSON(): string { return JSON.stringify(this.rows, null, 2); }

  exportCSV(): string {
    if (!this.rows.length) return '';
    const keys = Object.keys(this.rows[0]) as (keyof ResearchRow)[];
    const head = keys.join(',');
    const body = this.rows.map((r) => keys.map((k) => csv(r[k])).join(',')).join('\n');
    return `${head}\n${body}`;
  }

  // Numeric feature matrix for ML pipelines.
  featureMatrix(): { columns: string[]; X: number[][] } {
    return {
      columns: NUMERIC_FEATURES as string[],
      X: this.rows.map((r) => NUMERIC_FEATURES.map((k) => Number(r[k]) || 0)),
    };
  }
}

function csv(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const researchRecorder = new ResearchRecorder();
export type { ResearchRow } from './features';
