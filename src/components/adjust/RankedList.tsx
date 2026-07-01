import { inr, scoreColor } from './shared';
import type { Candidate } from '../../lib/adjust/types';

export function RankedList({ candidates, selectedId, onSelect, needThesis }: {
  candidates: Candidate[]; selectedId: string | null; onSelect: (id: string) => void; needThesis: boolean;
}) {
  if (needThesis) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <div className="text-[11px] font-bold text-[color:var(--gold)]">Select your market thesis</div>
        <div className="text-[10px] text-[color:var(--dim)]">
          Pick what you believe will happen (panel below-left) — the engine optimizes for that scenario, not a generic score.
        </div>
      </div>
    );
  }
  if (!candidates.length) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Awaiting live position…</div>;
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-auto pr-0.5">
      {candidates.map((c, i) => {
        const sc = scoreColor(c.score);
        const sel = c.id === selectedId;
        const a = c.analysis;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)}
            className="nav-item rounded-[7px] border px-2.5 py-2 text-left"
            style={{ borderColor: sel ? sc : 'var(--line-soft)', background: sel ? `color-mix(in srgb, ${sc} 8%, transparent)` : undefined }}>
            <div className="flex items-center gap-2">
              <span className="mono flex h-6 w-8 shrink-0 items-center justify-center rounded-[5px] text-[13px] font-extrabold"
                style={{ color: sc, background: `color-mix(in srgb, ${sc} 14%, transparent)` }}>{c.score}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[color:var(--text)]">
                <span className="text-[color:var(--faint)]">#{i + 1} </span>{c.label}
              </span>
              {c.flagged && <span className="shrink-0 rounded-[4px] px-1 py-px text-[7px] font-bold tracking-wider text-[color:var(--neg)]"
                style={{ background: 'color-mix(in srgb, var(--neg) 15%, transparent)' }}>WINNER RISK</span>}
            </div>
            <div className="mono mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5px] text-[color:var(--dim)]">
              <span>retain <b style={{ color: a.profitRetained >= 0.9 ? 'var(--pos)' : a.profitRetained >= 0.7 ? 'var(--gold)' : 'var(--neg)' }}>{Math.round(a.profitRetained * 100)}%</b></span>
              <span>eff <b style={{ color: a.opportunityEfficiency >= 3 ? 'var(--pos)' : 'var(--text)' }}>{a.opportunityEfficiency.toFixed(1)}×</b></span>
              <span>cost <b className="text-[color:var(--text)]">{a.premiumPaid > 0 ? inr(a.premiumPaid) : 'credit'}</b></span>
              <span>gain <b style={{ color: a.scenarioGain >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{inr(a.scenarioGain)}</b></span>
            </div>
            {sel && (
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {c.reasoning.map((r, j) => (
                  <li key={j} className="flex items-start gap-1 text-[9px] leading-snug"
                    style={{ color: r.startsWith('⚠') ? 'var(--neg)' : 'var(--dim)' }}>
                    <span className="mt-px shrink-0" style={{ color: sc }}>{r.startsWith('⚠') ? '' : '▸'}</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}
