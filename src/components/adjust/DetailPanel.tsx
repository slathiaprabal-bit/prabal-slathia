import { Metric, traderRows, legStr, scoreColor, inr } from './shared';
import type { Candidate, Metrics } from '../../lib/adjust/types';

const COMPONENTS: { key: keyof Candidate['analysis']['breakdown']; label: string; weight: number }[] = [
  { key: 'capital', label: 'Capital', weight: 30 },
  { key: 'objective', label: 'Objective', weight: 25 },
  { key: 'cost', label: 'Cost Eff.', weight: 20 },
  { key: 'risk', label: 'Risk', weight: 15 },
  { key: 'simplicity', label: 'Simple', weight: 10 },
];

export function DetailPanel({ candidate, base }: { candidate: Candidate | undefined; base: Metrics }) {
  if (!candidate) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Select an adjustment to see the full trader read.</div>;
  }
  const m = candidate.metrics;
  const a = candidate.analysis;
  const sc = scoreColor(candidate.score);
  const rows = traderRows(a);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto pr-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-[color:var(--text)]">{candidate.label}</div>
          <div className="mono mt-0.5 flex flex-wrap gap-1 text-[9px] text-[color:var(--dim)]">
            {candidate.resultLegs.map((l, i) => <span key={i} className="rounded bg-white/[0.05] px-1 py-px">{legStr(l)}</span>)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="eyebrow text-[7px]">TRADER SCORE</div>
          <div className="mono text-2xl font-extrabold leading-none" style={{ color: sc }}>{candidate.score}</div>
        </div>
      </div>

      {/* STEP 5 — the adjustment read: cost + trader deltas, not just P&L */}
      <div className="grid grid-cols-3 gap-1.5">
        {rows.map((r) => <Metric key={r.label} label={r.label} value={r.value} color={r.color} hint={r.hint} />)}
      </div>

      {/* STEP 6 — how the 30/25/20/15/10 score was earned */}
      <div className="cell px-2.5 py-1.5">
        <div className="eyebrow mb-1 text-[7.5px]">SCORE COMPOSITION</div>
        <div className="flex flex-col gap-1">
          {COMPONENTS.map((c) => {
            const v = a.breakdown[c.key];
            return (
              <div key={c.key} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[8px] text-[color:var(--dim)]">{c.label} <span className="text-[color:var(--faint)]">{c.weight}%</span></span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(v * 100)}%`, background: sc }} />
                </div>
                <span className="mono w-7 shrink-0 text-right text-[8px] text-[color:var(--text)]">{Math.round(v * 100)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {a.flags.length > 0 && (
        <div className="rounded-[6px] border px-2.5 py-1.5" style={{ borderColor: 'var(--neg)', background: 'color-mix(in srgb, var(--neg) 8%, transparent)' }}>
          {a.flags.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[9.5px] leading-snug text-[color:var(--neg)]">
              <span className="mt-px shrink-0">⚠</span><span>{f}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="eyebrow mb-1 text-[7.5px]">TRADER RATIONALE</div>
        <ul className="flex flex-col gap-0.5">
          {candidate.reasoning.filter((r) => !r.startsWith('⚠')).map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] leading-snug text-[color:var(--dim)]">
              <span className="mt-px shrink-0" style={{ color: sc }}>▸</span><span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto text-[8px] text-[color:var(--faint)]">
        vs current: θ {inr(m.theta - base.theta)}/d · POP {((m.pop - base.pop) * 100).toFixed(0)}pts · max loss {inr(m.maxLoss)} · margin {inr(m.margin)}
      </div>
    </div>
  );
}
